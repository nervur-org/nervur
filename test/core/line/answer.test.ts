// SPDX-License-Identifier: Apache-2.0
// The web carrier's inbound side on the standard Request and Response: a
// post's statuses and CORS, and a held line's messages, as any engine
// that hands its code a request meets them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hex } from '../../../src/core/crypto/index.ts';
import type { WebListen } from '../../../src/core/harbor/index.ts';
import { answerHeld, answerPost, askBody, readBody } from '../../../src/core/line/index.ts';

const PK = new Uint8Array(64).fill(7);
const listen: WebListen = { host: 'h', port: 0, path: '/q', origins: ['https://page.example'] };
const ground = {
  arrive: (pk: string) => (pk === hex(PK) ? Promise.resolve(Uint8Array.of(42)) : pk === hex(new Uint8Array(64)) ? Promise.reject(new Error('broken')) : Promise.resolve(null)),
};
const body = (pk: Uint8Array) => new Uint8Array([...pk, 1]);
const ask = (init: RequestInit & { path?: string } = {}) => answerPost(ground, listen, new Request(`https://h${init.path ?? '/q'}`, { method: 'POST', ...init }));

test('[answer] a post is answered with its reply or 204, and what is no ask is refused', async () => {
  const replied = await ask({ body: body(PK), headers: { origin: 'https://page.example' } });
  assert.equal(replied.status, 200);
  assert.deepEqual(new Uint8Array(await replied.arrayBuffer()), Uint8Array.of(42));
  assert.equal(replied.headers.get('access-control-allow-origin'), 'https://page.example');
  assert.equal((await ask({ body: body(new Uint8Array(64).fill(1)) })).status, 204, 'a ward nobody holds');
  assert.equal((await ask({ body: body(new Uint8Array(64)) })).status, 204, 'a door that throws');
  assert.equal((await ask({ body: body(PK), headers: { origin: 'https://evil.example' } })).headers.get('access-control-allow-origin'), null);
  assert.equal((await ask({ body: body(PK), path: '/other' })).status, 404);
  assert.equal((await ask({ body: Uint8Array.of(1) })).status, 400);
  assert.equal((await ask({ body: new Uint8Array(64 + 1_048_577) })).status, 400, 'a body past the largest ask');
  const got = await answerPost(ground, listen, new Request('https://h/q'));
  assert.equal(got.status, 405);
  assert.equal(got.headers.get('allow'), 'POST, OPTIONS');
  const preflight = await ask({ method: 'OPTIONS', headers: { origin: 'https://page.example' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST');
  assert.equal((await ask({ method: 'OPTIONS' })).headers.get('access-control-allow-methods'), null);
  const any = await answerPost(ground, { ...listen, origins: ['*'] }, new Request('https://h/q', { method: 'POST', body: body(PK), headers: { origin: 'https://any.example' } }));
  assert.equal(any.headers.get('access-control-allow-origin'), '*');
});

test('[answer] a held line answers an ask on the same line, and closes on what is no frame', async () => {
  const sent: (ReturnType<typeof readBody> | null)[] = [];
  let closed = 0;
  let heard = () => {};
  const side = {
    send: (b: Uint8Array) => {
      sent.push(readBody(b));
      heard();
    },
    close: () => (closed += 1),
  };
  const next = () => new Promise<void>((done) => (heard = done));
  let waiting = next();
  answerHeld(ground, side, askBody(5, PK, Uint8Array.of(1)));
  await waiting;
  waiting = next();
  answerHeld(ground, side, askBody(6, new Uint8Array(64), Uint8Array.of(1)));
  await waiting;
  assert.deepEqual(sent, [
    { kind: 'reply', id: 5, box: Uint8Array.of(42) },
    { kind: 'nothing', id: 6 },
  ]);
  answerHeld(ground, side, Uint8Array.of(2, 0, 0, 0, 9));
  assert.equal(sent.length, 2, 'a nothing frame on the line asks nothing');
  answerHeld(ground, side, 'text');
  answerHeld(ground, side, Uint8Array.of(9));
  assert.equal(closed, 2);
});
