// The listener's side of a held line pings, so a router between keeps the
// line, and closes a line that stays silent, so its dialer dials again.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, connect, type Socket } from 'node:net';
import { test } from 'node:test';
import { hold } from '../../../src/node/websocket.ts';

const PING = 0x89;
const PONG = 0x8a;

// A socket pair: the listener's end held as a WebSocket, and a raw client end the test reads.
const pair = async (t: { after(done: () => unknown): void }, ping: number) => {
  const server = createServer((socket) => hold(socket, () => ({ message: () => undefined, close: () => undefined }), 1024, { ping }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const client = connect({ host: '127.0.0.1', port: typeof address === 'object' && address !== null ? address.port : 0 });
  t.after(() => {
    client.destroy();
    server.close();
  });
  await once(client, 'connect');
  return client;
};

// The first frame's first byte the client reads.
const firstFrame = async (client: Socket) => ((await once(client, 'data')) as [Buffer])[0][0];

test('A held line is pinged, and stands while its dialer answers', async (t) => {
  const client = await pair(t, 10);
  assert.equal(await firstFrame(client), PING);
  // A masked pong with no payload, as a client writes it.
  client.write(Buffer.from([PONG, 0x80, 0, 0, 0, 0]));
  assert.equal(await firstFrame(client), PING, 'the line stands, and is pinged again');
  assert.equal(client.destroyed, false);
});

test('A held line silent across two pings is closed, so its dialer dials again', async (t) => {
  const client = await pair(t, 10);
  client.resume();
  await once(client, 'end');
});
