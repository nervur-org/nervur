// SPDX-License-Identifier: Apache-2.0
// `nervur/tcp`: the frames of CARRIER-TCP.md, the dialer's address book,
// and the listener, each at the edges the verifier does not walk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, createServer, type Socket } from 'node:net';
import { hex } from '../../../src/core/crypto/index.ts';
import { tcpAddress } from '../../../src/core/quo/index.ts';
import { askFrame, FrameReader, MAX_BODY, nothingFrame, replyFrame } from '../../../src/core/line/index.ts';
import { TcpCarrier, TcpListener } from '../../../src/core/tcp/index.ts';
import { holds } from '../../claims.ts';

const PK = new Uint8Array(64).fill(7);
const head = (length: number, ...body: number[]): Uint8Array => {
  const out = new Uint8Array(4 + body.length);
  new DataView(out.buffer).setUint32(0, length);
  out.set(body, 4);
  return out;
};

test('[tcp] frames are written and read back, a byte at a time or many at once', () => {
  const bytes = [askFrame(1, PK, Uint8Array.of(1, 2)), replyFrame(0xffff_ffff, Uint8Array.of(3)), nothingFrame(9)];
  const reader = new FrameReader();
  const all = new Uint8Array(bytes.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of bytes) {
    all.set(b, at);
    at += b.length;
  }
  const frames = [...all].flatMap((byte) => reader.push(Uint8Array.of(byte)));
  assert.deepEqual(frames, [
    { kind: 'ask', id: 1, pk: PK, box: Uint8Array.of(1, 2) },
    { kind: 'reply', id: 0xffff_ffff, box: Uint8Array.of(3) },
    { kind: 'nothing', id: 9 },
  ]);
  assert.equal(new FrameReader().push(all).length, 3);
  assert.equal(reader.bad, false);
});

test('[tcp] bytes that are not a frame stop the reader, and nothing after them is read', () => {
  const cases = [head(MAX_BODY + 1), head(0xffff_ffff), head(4, 2, 0, 0, 0), head(0), head(5, 3, 0, 0, 0, 1), head(68, 0, 0, 0, 0, 1), head(6, 2, 0, 0, 0, 1, 0)];
  for (const bytes of cases) {
    const reader = new FrameReader();
    assert.deepEqual(reader.push(bytes), [], hex(bytes));
    assert.equal(reader.bad, true, hex(bytes));
    assert.deepEqual(reader.push(nothingFrame(1)), []);
  }
  const reader = new FrameReader();
  assert.equal(reader.push(new Uint8Array([...nothingFrame(1), ...head(4)])).length, 1);
  assert.equal(reader.bad, true);
  const largest = new FrameReader();
  assert.deepEqual(largest.push(head(MAX_BODY, 0)), []);
  assert.equal(largest.bad, false);
});

test('[tcp] a carrier routes a ward pk to its tcp addresses, and carries nothing where none answers', async () => {
  const carrier = new TcpCarrier();
  const pk = hex(PK);
  assert.equal(carrier.route('ab', ['tcp://127.0.0.1:1']), false);
  assert.equal(carrier.route(pk, ['nowhere', 'https://example.org/quo', 'tcp://a:0']), false, 'no tcp address among them');
  assert.equal(carrier.routed(pk), false);
  assert.equal(await carrier.carry(pk, Uint8Array.of(1)), null, 'no route');
  const closed = await freePort();
  assert.equal(carrier.route(pk, ['https://example.org/quo', `tcp://127.0.0.1:${closed}`]), true);
  assert.equal(carrier.routed(pk), true);
  assert.equal(await carrier.carry(pk, Uint8Array.of(1)), null, 'nobody listens');
  assert.equal(await carrier.carryAt([`tcp://127.0.0.1:${closed}`], 'ab', Uint8Array.of(1)), null, 'no ward pk');
  assert.equal(carrier.route(pk, null), true);
  assert.equal(carrier.route(pk, null), true, 'forgetting twice is forgetting');
  assert.equal(carrier.routed(pk), false);
  await carrier.close();
});

test(holds('route.in-order', 'tcp: an ask goes to the next address only when the one before cannot be dialed'), async () => {
  const listener = await TcpListener.listen({ arrive: () => Promise.resolve(Uint8Array.of(42)) });
  const closed = await freePort();
  const carrier = new TcpCarrier();
  const pk = hex(PK);
  assert.deepEqual(await carrier.carryAt([`tcp://127.0.0.1:${closed}`, listener.at], pk, Uint8Array.of(1)), Uint8Array.of(42));
  carrier.route(pk, [`tcp://127.0.0.1:${closed}`, listener.at]);
  assert.deepEqual(await carrier.carry(pk, Uint8Array.of(1)), Uint8Array.of(42));
  assert.match(listener.at, /^tcp:\/\/127\.0\.0\.1:\d+$/);
  await carrier.close();
  await listener.close();
});

test('[tcp] a carrier hears nothing when the far side closes, ignores what it does not wait for, and dials again', async () => {
  const sockets: Socket[] = [];
  let mode: 'close' | 'odd' | 'garbage' = 'close';
  const server = createServer((socket) => {
    sockets.push(socket);
    const reader = new FrameReader();
    socket.on('data', (chunk: Buffer) => {
      for (const f of reader.push(new Uint8Array(chunk))) {
        if (f.kind !== 'ask') continue;
        if (mode === 'close') socket.destroy();
        else if (mode === 'odd') socket.write(new Uint8Array([...askFrame(f.id, PK, Uint8Array.of(0)), ...replyFrame(f.id + 100, Uint8Array.of(0)), ...replyFrame(f.id, Uint8Array.of(42))]));
        else socket.write(head(3));
      }
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  const carrier = new TcpCarrier();
  const pk = hex(PK);
  carrier.route(pk, [`tcp://127.0.0.1:${port}`]);
  assert.equal(await carrier.carry(pk, Uint8Array.of(1)), null);
  mode = 'odd';
  assert.deepEqual(await carrier.carry(pk, Uint8Array.of(1)), Uint8Array.of(42));
  mode = 'garbage';
  assert.equal(await carrier.carry(pk, Uint8Array.of(1)), null);
  await carrier.close();
  for (const s of sockets) s.destroy();
  await new Promise((done) => server.close(done));
});

test('[tcp] a listener answers nothing for a ward it does not hold or a door that throws, and ignores reply frames', async () => {
  const listener = await TcpListener.listen({
    arrive: (pk) => (pk === hex(PK) ? Promise.reject(new Error('broken')) : Promise.resolve(null)),
  });
  const { host, port } = tcpAddress(listener.at)!;
  const socket = connect({ host, port });
  const reader = new FrameReader();
  const frames: unknown[] = [];
  const both = new Promise<void>((done) =>
    socket.on('data', (chunk: Buffer) => {
      frames.push(...reader.push(new Uint8Array(chunk)));
      if (frames.length >= 2) done();
    }),
  );
  await new Promise((done) => socket.once('connect', done));
  socket.write(new Uint8Array([...replyFrame(5, Uint8Array.of(1)), ...askFrame(1, PK, Uint8Array.of(1)), ...askFrame(2, new Uint8Array(64), Uint8Array.of(1))]));
  await both;
  assert.deepEqual(frames.sort((a, b) => (a as { id: number }).id - (b as { id: number }).id), [
    { kind: 'nothing', id: 1 },
    { kind: 'nothing', id: 2 },
  ]);
  const gone = new Promise((done) => socket.once('close', done));
  await listener.close();
  await gone;
});

const freePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  await new Promise((done) => server.close(done));
  return port;
};
