// SPDX-License-Identifier: Apache-2.0
// The web listener on Node's HTTP server: a post's statuses and CORS, and
// a held line's messages, each against doors a test holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hex } from '../../../src/core/crypto/index.ts';
import { webServe } from '../../../src/core/http/index.ts';
import { askBody, nothingBody, readBody, replyBody } from '../../../src/core/line/index.ts';

const PK = new Uint8Array(64).fill(7);
const own = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

test('[web] a listener answers a post with a reply or 204, and refuses what is no ask', async () => {
  const doors = { arrive: (pk: string) => Promise.resolve(pk === hex(PK) ? Uint8Array.of(42) : pk === hex(new Uint8Array(64)) ? Promise.reject(new Error('broken')) : null) };
  const listener = await webServe(doors as never, { host: '127.0.0.1', port: 0, path: '/q', origins: ['https://page.example'] });
  const [post] = listener.at as [string];
  const body = (pk: Uint8Array, box: Uint8Array) => new Uint8Array([...pk, ...box]);
  const r = await fetch(post, { method: 'POST', body: body(PK, Uint8Array.of(1)), headers: { origin: 'https://page.example' } });
  assert.equal(r.status, 200);
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), Uint8Array.of(42));
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://page.example');
  assert.equal((await fetch(post, { method: 'POST', body: body(new Uint8Array(64).fill(1), Uint8Array.of(1)) })).status, 204, 'a ward it does not hold');
  assert.equal((await fetch(post, { method: 'POST', body: body(new Uint8Array(64), Uint8Array.of(1)) })).status, 204, 'a door that throws');
  const other = await fetch(post, { method: 'POST', body: body(PK, Uint8Array.of(1)), headers: { origin: 'https://evil.example' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null, 'an origin it does not name');
  const preflight = await fetch(post, { method: 'OPTIONS', headers: { origin: 'https://page.example', 'access-control-request-method': 'POST' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST');
  assert.equal((await fetch(post, { method: 'OPTIONS' })).headers.get('access-control-allow-methods'), null);
  assert.equal((await fetch(post.replace('/q', '/other'), { method: 'POST', body: body(PK, Uint8Array.of(1)) })).status, 404);
  assert.equal((await fetch(`${post}?x=1`, { method: 'POST', body: body(PK, Uint8Array.of(1)) })).status, 200, 'a query is no other path');
  assert.equal((await fetch(post)).status, 405);
  assert.equal((await fetch(post, { method: 'POST', body: PK })).status, 400, 'a ward pk with no box');
  assert.equal((await fetch(post, { method: 'POST', body: new Uint8Array(64 + 1_048_577) })).status, 400, 'a box above the size');
  await listener.close();
});

// A held line opened by hand, with every message it hears.
const line = (href: string, protocols: string[] = ['quo']): Promise<{ socket: WebSocket; heard: unknown[]; closed: Promise<void> }> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(href, protocols);
    socket.binaryType = 'arraybuffer';
    const heard: unknown[] = [];
    const closed = new Promise<void>((done) => socket.addEventListener('close', () => done()));
    socket.addEventListener('message', (e: MessageEvent) => heard.push(typeof e.data === 'string' ? e.data : readBody(new Uint8Array(e.data as ArrayBuffer))));
    socket.addEventListener('open', () => resolve({ socket, heard, closed }));
    socket.addEventListener('error', () => reject(new Error('refused')));
  });
const next = async (heard: unknown[], n: number): Promise<void> => {
  while (heard.length < n) await new Promise((done) => setImmediate(done));
};

test('[web] a held line answers each ask, ignores replies, and closes at a text message or bytes that are no frame', async () => {
  const doors = { arrive: (pk: string) => Promise.resolve(pk === hex(PK) ? Uint8Array.of(42) : null) };
  const listener = await webServe(doors, { host: '127.0.0.1', port: 0, path: '/', origins: ['*'] });
  const held = listener.at[1]!;
  await assert.rejects(line(held, ['other']), /refused/, 'a line that offers no quo');
  await assert.rejects(line(held.replace(/\/$/, '/elsewhere')), /refused/, 'another path');
  const a = await line(held);
  assert.equal(a.socket.protocol, 'quo');
  a.socket.send(own(replyBody(9, Uint8Array.of(1))));
  a.socket.send(own(nothingBody(8)));
  a.socket.send(own(askBody(1, PK, Uint8Array.of(1))));
  a.socket.send(own(askBody(2, new Uint8Array(64), Uint8Array.of(1))));
  await next(a.heard, 2);
  assert.deepEqual(a.heard, [
    { kind: 'reply', id: 1, box: Uint8Array.of(42) },
    { kind: 'nothing', id: 2 },
  ]);
  a.socket.send('text');
  await a.closed;
  const b = await line(held);
  b.socket.send(Uint8Array.of(1, 2));
  await b.closed;
  const big = await line(held);
  big.socket.send(own(askBody(3, PK, new Uint8Array(70_000))));
  await next(big.heard, 1);
  assert.deepEqual(big.heard, [{ kind: 'reply', id: 3, box: Uint8Array.of(42) }], 'a message longer than 65,535 bytes');
  big.socket.close();
  await big.closed;
  await listener.close();
});
