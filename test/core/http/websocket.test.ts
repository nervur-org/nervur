// SPDX-License-Identifier: Apache-2.0
// The server side of RFC 6455 a held line needs: the accept key, frames
// written plain, and a reader of masked frames that stops at the first
// byte that breaks the RFC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptKey, frameOf, isClientKey, OP, WsReader } from '../../../src/core/http/websocket.ts';

// A frame as a client writes it, masked unless told otherwise.
const client = (opcode: number, payload: Uint8Array, { fin = true, mask = true, rsv = 0 } = {}): Uint8Array => {
  const plain = frameOf(opcode, payload);
  const head = plain.subarray(0, plain.length - payload.length);
  head[0] = (fin ? 0x80 : 0) | rsv | opcode;
  if (!mask) return plain;
  const key = Uint8Array.of(1, 2, 3, 4);
  const out = new Uint8Array(head.length + 4 + payload.length);
  out.set(head);
  out[1]! |= 0x80;
  out.set(key, head.length);
  for (let i = 0; i < payload.length; i += 1) out[head.length + 4 + i] = payload[i]! ^ key[i & 3]!;
  return out;
};

test('[websocket] the accept key and a client key are as RFC 6455 writes them', () => {
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  assert.ok(isClientKey('dGhlIHNhbXBsZSBub25jZQ=='));
  for (const key of ['short', 7, undefined, 'dGhlIHNhbXBsZSBub25jZQ']) assert.ok(!isClientKey(key));
});

test('[websocket] frames of every length are written and read back, a byte at a time or joined from fragments', () => {
  for (const length of [0, 125, 126, 65_535, 65_536]) {
    const payload = new Uint8Array(length).fill(9);
    const whole = new WsReader(1 << 20).push(client(OP.binary, payload));
    assert.deepEqual(whole, [{ type: 'binary', data: payload }], String(length));
  }
  const reader = new WsReader(100);
  const bytes = [...client(OP.binary, Uint8Array.of(1, 2), { fin: false }), ...client(OP.ping, Uint8Array.of(7)), ...client(OP.pong, new Uint8Array(0)), ...client(OP.continuation, Uint8Array.of(3))];
  const out = bytes.flatMap((byte) => reader.push(Uint8Array.of(byte)));
  assert.deepEqual(out, [
    { type: 'ping', data: Uint8Array.of(7) },
    { type: 'binary', data: Uint8Array.of(1, 2, 3) },
  ]);
  assert.deepEqual(new WsReader(100).push(new Uint8Array([...client(OP.text, Uint8Array.of(65), { fin: false }), ...client(OP.continuation, Uint8Array.of(66))])), [{ type: 'text' }]);
  assert.deepEqual(new WsReader(100).push(client(OP.text, Uint8Array.of(65))), [{ type: 'text' }]);
  const closing = new WsReader(100);
  assert.deepEqual(closing.push(new Uint8Array([...client(OP.close, new Uint8Array(0)), ...client(OP.binary, Uint8Array.of(1))])), [{ type: 'close' }]);
  assert.deepEqual(closing.push(client(OP.binary, Uint8Array.of(1))), [], 'nothing after a close');
});

test('[websocket] a frame that breaks the RFC or runs past the longest message stops the reader', () => {
  const bad = [
    client(OP.binary, Uint8Array.of(1), { mask: false }),
    client(OP.binary, Uint8Array.of(1), { rsv: 0x40 }),
    client(OP.ping, new Uint8Array(126)),
    client(OP.ping, Uint8Array.of(1), { fin: false }),
    client(OP.continuation, Uint8Array.of(1)),
    new Uint8Array([...client(OP.binary, Uint8Array.of(1), { fin: false }), ...client(OP.binary, Uint8Array.of(2))]),
    client(0x3, Uint8Array.of(1)),
    client(OP.binary, new Uint8Array(101)),
    client(OP.binary, new Uint8Array(70_000)),
  ];
  for (const bytes of bad) {
    const reader = new WsReader(100);
    const events = reader.push(bytes);
    assert.equal(events.at(-1)?.type, 'bad', String(bytes.slice(0, 2)));
    assert.deepEqual(reader.push(client(OP.binary, Uint8Array.of(1))), [], 'nothing after');
  }
  const huge = new Uint8Array(14);
  huge.set([0x82, 0xff]);
  new DataView(huge.buffer).setBigUint64(2, 2n ** 40n);
  assert.equal(new WsReader(100).push(huge).at(-1)?.type, 'bad', 'a 64-bit length past the longest');
  assert.deepEqual(new WsReader(100).push(Uint8Array.of(0x82, 0xfe, 0)), [], 'a 16-bit length not yet whole');
  assert.deepEqual(new WsReader(100).push(Uint8Array.of(0x82, 0xff, 0, 0)), [], 'a 64-bit length not yet whole');
});
