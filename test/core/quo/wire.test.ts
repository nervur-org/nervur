// SPDX-License-Identifier: Apache-2.0
// The formats of `quo/`: the ward key, the invitation, the payload and the
// reply, each read as strictly as the spec says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hex, sha256, utf8 } from '../../../src/core/crypto/index.ts';
import { readInvitation, readPayload, readReply, SILENCE, WardKey, writePayload, writeReply } from '../../../src/core/quo/index.ts';
import { Door, MemoryRelations } from '../../../src/core/quo/index.ts';
import { draw, Echo } from './scene.ts';

const pk = 'ab'.repeat(32);
const text = (s: string) => utf8(s);

test('[wire] a ward pk is the signing pk then the padlock, and a text seed is hashed', async () => {
  const key = await WardKey.from('alice');
  assert.match(key.pk, /^[0-9a-f]{128}$/);
  assert.equal(key.pk, (await WardKey.from(await sha256(utf8('alice')))).pk);
  assert.equal(key.pk.slice(0, 64), hex(key.signing.pk));
  assert.equal(key.pk.slice(64), hex(key.padlock));
  assert.notEqual((await WardKey.from(new Uint8Array(31))).pk, (await WardKey.from(new Uint8Array(32))).pk);
});

test('[wire] an invitation is the four fields, and a field beside them is ignored', async () => {
  const door = new Door(await WardKey.from('a'), new MemoryRelations(), new Echo(), draw);
  const { invitation } = await door.invite();
  assert.deepEqual(readInvitation({ ...invitation, note: 1 }), invitation);
  const { ward, heir, secret, lock } = invitation;
  for (const bad of [{ ward }, { ward, secret }, { ward, lock }, { ward, heir, secret }, { ward, heir, lock }, { ward, secret, lock }, { ...invitation, lock: lock.toUpperCase() }, { ...invitation, lock: lock.slice(2) }, null, 'x', []]) {
    assert.equal(readInvitation(bad), null);
  }
  assert.equal(readInvitation({ ward, heir, secret, lock: `ff${'ff'.repeat(1183)}` }), null);
});

test('[wire] a payload is written in field order, and read back as written', () => {
  const written = writePayload({ to: null, by: pk, next: null, seq: 7, method: 'm', args: '{ "x" : 1e400 }' });
  assert.equal(written, `{"to":null,"by":"${pk}","next":null,"seq":7,"method":"m","args":{ "x" : 1e400 }}`);
  assert.deepEqual(readPayload(text(written)), { payload: { to: null, by: pk, next: null, seq: 7, method: 'm', args: '{ "x" : 1e400 }' } });
  assert.deepEqual(readPayload(text(`{"to":"${pk}","by":"${pk}","next":"${pk}","seq":1,"extra":[1]}`)), { payload: { to: pk, by: pk, next: pk, seq: 1 } });
});

test('[wire] a payload that is not well formed is told apart from one that is no object', () => {
  const zero = '0'.repeat(64);
  const base = { to: 'null', by: `"${pk}"`, next: 'null', seq: '1' };
  const write = (fields: Record<string, string>) => text(`{${Object.entries(fields).map(([k, v]) => `"${k}":${v}`).join(',')}}`);
  for (const bad of [
    { ...base, by: `"${zero}"` },
    { ...base, by: 'null' },
    { ...base, to: `"${pk.toUpperCase()}"` },
    { ...base, next: '1' },
    { ...base, seq: '1.0' },
    { ...base, seq: '0' },
    { ...base, method: 'null' },
    { ...base, args: '[]' },
    { ...base, args: 'null' },
    { to: 'null', by: `"${pk}"`, seq: '1' },
  ]) {
    assert.deepEqual(readPayload(write(bad)), { fault: 'not well formed' }, JSON.stringify(bad));
  }
  for (const bad of ['[]', '{"a":1,"a":1}', 'nope']) assert.deepEqual(readPayload(text(bad)), { fault: 'not an object' });
});

test('[wire] a reply is one of three shapes with no field beside it', () => {
  assert.equal(writeReply({ silence: true }), SILENCE);
  assert.equal(SILENCE.length, 16);
  assert.equal(writeReply({ quo: 'removed' }), '{"quo":"removed"}');
  assert.equal(writeReply({ object: '[1, 2]', seen: 'x' }), '{"object":[1, 2],"seen":"x"}');
  assert.deepEqual(readReply(text(' { "seen" : null, "object" : {"a":1} } ')), { object: '{"a":1}', seen: null });
  assert.deepEqual(readReply(text('{"silence": true}')), { silence: true });
  assert.deepEqual(readReply(text('{"quo":"repeated"}')), { quo: 'repeated' });
  for (const bad of ['{"object":1}', '{"object":1,"seen":2}', '{"object":1,"seen":null,"x":1}', '{"silence":false}', '{"silence":true,"quo":"removed"}', '{"quo":"threw"}', '{"quo":1}', '{"object":1,"object":1,"seen":null}', '[]']) {
    assert.equal(readReply(text(bad)), null, bad);
  }
});
