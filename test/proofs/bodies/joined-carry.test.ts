// JoinedCarry: several carries as one, held to the carry suite, and to
// sending each address by the carry of its scheme.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JoinedCarry } from 'nervur';
import { FakeCarry } from 'nervur/bench';
import type { Door } from '../../../src/bench/fake-carry.ts';
import { carrySuite } from '../suites/carry.ts';

// A join of one carry keeps the contract whole.
carrySuite('JoinedCarry', async () => {
  const network = new Map<string, Door>();
  const one = new FakeCarry({ network, address: 'fake://one' });
  const two = new FakeCarry({ network, address: 'fake://two' });
  return {
    one: new JoinedCarry({ fake: one }),
    two: new JoinedCarry({ fake: two }),
    listen: async (listened) => two.listen(listened),
    nowhere: 'fake://nowhere',
    cut: async () => {
      one.lose = 1;
    },
    spare: async () => {
      let reached = false;
      network.set('fake://spare', async () => {
        reached = true;
        return new Uint8Array([9]);
      });
      return { at: 'fake://spare', reached: () => reached };
    },
    close: async () => undefined,
  };
});

const ward = 'ab'.repeat(64);
const box = new Uint8Array([1]);

test('JoinedCarry names every carry’s addresses, and sends each address by the carry of its scheme, in order', async () => {
  const tcpNet = new Map<string, Door>();
  const webNet = new Map<string, Door>();
  const joined = new JoinedCarry({ tcp: new FakeCarry({ network: tcpNet, address: 'tcp://shop:7000' }), https: new FakeCarry({ network: webNet, address: 'https://shop/quo' }) });
  assert.deepEqual(joined.at({}), ['tcp://shop:7000', 'https://shop/quo']);

  webNet.set('https://shop/quo', async () => new Uint8Array([2]));
  assert.deepEqual(await joined.send({ ward, at: ['tcp://shop:7000', 'https://shop/quo'], box }), { reply: new Uint8Array([2]), via: 'https://shop/quo' }, 'the tcp address did not hear, so the web one was tried');
  assert.deepEqual(await joined.send({ ward, at: ['ws://unspoken/quo'], box }), { reply: null, heard: false }, 'a scheme no carry speaks is passed');
  assert.equal((await joined.send({ ward, at: ['HTTPS://shop/quo'], box })).reply !== null, false, 'the fake web carry knows only its own spelling');
  webNet.set('HTTPS://shop/quo', async () => new Uint8Array([4]));
  assert.deepEqual(await joined.send({ ward, at: ['HTTPS://shop/quo'], box }), { reply: new Uint8Array([4]), via: 'HTTPS://shop/quo' }, 'a scheme is read in any case');
});

test('JoinedCarry carries a box that may have been heard over one carry to no address of another', async () => {
  const tcpNet = new Map<string, Door>([['tcp://shop:7000', async () => new Uint8Array([3])]]);
  const webNet = new Map<string, Door>([['https://shop/quo', async () => new Uint8Array([2])]]);
  const tcp = new FakeCarry({ network: tcpNet, address: 'tcp://shop:7000' });
  const web = new FakeCarry({ network: webNet, address: 'https://shop/quo' });
  const joined = new JoinedCarry({ tcp, https: web });
  tcp.lose = 1;
  assert.deepEqual(await joined.send({ ward, at: ['tcp://shop:7000', 'https://shop/quo'], box }), { reply: null, heard: true });
  assert.deepEqual(web.tried, []);
});
