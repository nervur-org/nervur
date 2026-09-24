// WebCarry on the ground's one HTTP listener: the carry suite over the post
// and over the held line, and the listener chaining handlers on one port.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WebCarry, type Handler } from 'nervur';
import { serveHttp, type Served } from 'nervur/node';
import { carrySuite } from '../suites/carry.ts';

const WARD = 'ab'.repeat(64);

for (const scheme of ['http', 'ws'] as const) {
  carrySuite(`WebCarry over ${scheme}`, async () => {
    const opened: Served[] = [];
    const listener = async (carry: WebCarry) => {
      const served = await serveHttp({ host: '127.0.0.1' }, [carry]);
      opened.push(served);
      return `${scheme}://127.0.0.1:${served.port}/quo`;
    };
    let at = '';
    const one = new WebCarry({ allowPrivate: true });
    const two = new WebCarry({ allowPrivate: true, addresses: () => [at] });
    at = await listener(two);
    return {
      one,
      two,
      listen: async (listened) => two.listen(listened),
      // Port 1 refuses on this host, so nothing there ever heard a box.
      nowhere: `${scheme}://127.0.0.1:1/quo`,
      // The listener goes while the ask is in flight, so the reply is lost.
      cut: () => opened[0].close(),
      spare: async () => {
        let reached = false;
        const three = new WebCarry({ allowPrivate: true });
        three.listen({
          ward: WARD,
          door: async () => {
            reached = true;
            return new Uint8Array([9]);
          },
        });
        return { at: await listener(three), reached: () => reached };
      },
      close: async () => {
        await one.close();
        for (const served of opened) await served.close();
      },
    };
  });
}

// A face: a handler of its own, beside the carry on the one port.
const face: Handler = {
  fetch: async (request) => (new URL(request.url).pathname === '/hello' ? new Response('hello', { status: 200 }) : null),
};

test('One listener chains its handlers: each request to the first that answers it, and 404 where none does', async (t) => {
  const carry = new WebCarry();
  const served = await serveHttp({ host: '127.0.0.1' }, [carry, face]);
  t.after(() => served.close());
  const base = `http://127.0.0.1:${served.port}`;
  assert.equal(await (await fetch(`${base}/hello`)).text(), 'hello', 'the face answers its own path on the carry’s port');
  assert.equal((await fetch(`${base}/elsewhere`)).status, 404);
  assert.equal((await fetch(`${base}/quo`)).status, 405, 'the carry answers its path, and a GET is no ask');
  assert.equal((await fetch(`${base}/quo`, { method: 'POST', body: new Uint8Array(10) })).status, 400, 'a body shorter than a ward pk and a byte is no ask');
  assert.equal((await fetch(`${base}/quo`, { method: 'POST', body: new Uint8Array(70) })).status, 404, 'no ward under that pk');
});

test('The held line is refused to a handshake that does not offer the subprotocol quo', async (t) => {
  const served = await serveHttp({ host: '127.0.0.1' }, [new WebCarry()]);
  t.after(() => served.close());
  const refused = await new Promise<boolean>((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${served.port}/quo`);
    socket.onopen = () => {
      socket.close();
      resolve(false);
    };
    socket.onerror = () => resolve(true);
  });
  assert.equal(refused, true);
});

test('A post from a page of another origin is answered by CORS only where the carry names that origin', async (t) => {
  const served = await serveHttp({ host: '127.0.0.1' }, [new WebCarry({ origins: ['https://shop.example'] })]);
  t.after(() => served.close());
  const at = `http://127.0.0.1:${served.port}/quo`;
  const named = await fetch(at, { method: 'OPTIONS', headers: { origin: 'https://shop.example' } });
  assert.equal(named.headers.get('access-control-allow-origin'), 'https://shop.example');
  const other = await fetch(at, { method: 'POST', headers: { origin: 'https://elsewhere.example' }, body: new Uint8Array(70) });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});
