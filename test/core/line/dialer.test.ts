// SPDX-License-Identifier: Apache-2.0
// The web dialer on `fetch` and the WebSocket client: what it could not
// dial, and a line that closes with an ask in flight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { UNDIALED } from '../kit.ts';
import { hex } from '../../../src/core/crypto/index.ts';
import { webServe } from '../../../src/core/http/index.ts';
import { WebDialer } from '../../../src/core/line/index.ts';

const PK = new Uint8Array(64).fill(7);

const freePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  await new Promise((done) => server.close(done));
  return port;
};

test('[web] a dialer says what it could not dial, and a line that closes answers nothing', async () => {
  const dialer = new WebDialer();
  const pk = hex(PK);
  const free = await freePort();
  assert.equal(await dialer.dial('tcp://127.0.0.1:1', pk, Uint8Array.of(1)), UNDIALED);
  assert.equal(await dialer.dial(`http://127.0.0.1:${free}/`, 'ab', Uint8Array.of(1)), UNDIALED);
  assert.equal(await dialer.dial(`http://127.0.0.1:${free}/`, pk, Uint8Array.of(1)), UNDIALED, 'nobody listens');
  assert.equal(await dialer.dial(`ws://127.0.0.1:${free}/`, pk, Uint8Array.of(1)), UNDIALED, 'no line opens');
  let heard!: () => void;
  const arrived = new Promise<void>((done) => (heard = done));
  const silent = await webServe(
    {
      arrive: () => {
        heard();
        return new Promise<null>(() => {});
      },
    },
    { host: '127.0.0.1', port: 0, path: '/', origins: [] },
  );
  const waiting = dialer.dial(silent.at[1]!, pk, Uint8Array.of(1));
  await arrived;
  await silent.close();
  assert.equal(await waiting, null, 'the line closed with the ask in flight');
  const sockets: Socket[] = [];
  const plain = createServer((socket) => {
    sockets.push(socket);
    socket.end('HTTP/1.1 200 OK\r\nconnection: close\r\ncontent-length: 0\r\n\r\n');
  });
  await new Promise<void>((done) => plain.listen(0, '127.0.0.1', done));
  const { port } = plain.address() as { port: number };
  assert.equal(await dialer.dial(`ws://127.0.0.1:${port}/`, pk, Uint8Array.of(1)), UNDIALED, 'a server that speaks no WebSocket');
  assert.equal(await dialer.dial(`http://127.0.0.1:${port}/`, pk, Uint8Array.of(1)), null, 'a 200 with no body is nothing');
  for (const socket of sockets) socket.destroy();
  await new Promise((done) => plain.close(done));
  await dialer.close();
});
