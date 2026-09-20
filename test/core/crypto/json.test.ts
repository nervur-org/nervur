// SPDX-License-Identifier: Apache-2.0
// The two readers of `crypto/json.ts`: Quo's, which keeps every field as
// written, and Nervur's, which a being's values pass through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCount, readObject, readValue, writeValue } from '../../../src/core/crypto/index.ts';
import { holds } from '../../claims.ts';

const fields = (text: string | Uint8Array) => {
  const read = readObject(text);
  return read === null ? null : Object.fromEntries(read);
};

test(holds('reader.quo-side', 'json: an object is read into its fields, each kept as the text it was written in'), () => {
  const text = ' {"to" : null,\n"args":{"b":1,  "a":1e400,"a":-0},"n":9007199254740993} ';
  assert.deepEqual(fields(text), { to: 'null', args: '{"b":1,  "a":1e400,"a":-0}', n: '9007199254740993' });
  assert.deepEqual(fields('{"a":1.25,"b":1e+5,"c":1E-2}'), { a: '1.25', b: '1e+5', c: '1E-2' });
});

test('[json] two own keys of one name are no object, escapes read first', () => {
  assert.equal(fields('{"a":1,"a":2}'), null);
  assert.equal(fields('{"a":1,"\\u0061":2}'), null);
  assert.deepEqual(fields('{"a":{"b":1,"b":2}}'), { a: '{"b":1,"b":2}' });
});

test('[json] a text that is not one object is no object', () => {
  for (const text of ['[]', '"a"', '1', 'null', '', '{', '{"a"}', '{"a":1,}', '{"a":1} x', '{} {}', '{"a":01}', '{"a":"\\x"}', '{"a":""}', "{'a':1}", '{"a":"\\u12"}', '{a":1}', '{:1}', '{"a" 1}', '{"a":[1}}', '["a":1}', '{"a":1x"b":2}']) {
    assert.equal(fields(text), null, text);
  }
});

test('[json] bytes that are not UTF-8, or that open with a byte order mark, are no JSON text', () => {
  assert.equal(fields(Uint8Array.of(0x7b, 0xff, 0x7d)), null);
  assert.equal(fields(Uint8Array.of(0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d)), null, 'a bad byte inside a string is not mended');
  assert.equal(fields(Uint8Array.of(0xef, 0xbb, 0xbf, 0x7b, 0x7d)), null);
  assert.deepEqual(fields(new TextEncoder().encode('{}')), {});
});

test('[json] a field nested far deeper than any stack still reads, as the grammar alone', () => {
  const deep = `${'['.repeat(200_000)}${']'.repeat(200_000)}`;
  assert.equal(fields(`{"args":${deep}}`)?.args, deep);
  assert.equal(fields(`{"args":${deep.slice(1)}}`), null);
});

test('[json] a being is handed a value within the depth bound', () => {
  assert.deepEqual(readValue('{"a":[1,{"b":"c"}],"d":true}', 3), { a: [1, { b: 'c' }], d: true });
  assert.equal(readValue('[[[1]]]', 2), undefined);
  assert.deepEqual(readValue('[[1]]', 2), [[1]]);
  assert.equal(readValue('null', 0), null);
  assert.deepEqual(readValue('["[[["]', 1), ['[[['], 'a bracket inside a string is no nesting');
  assert.equal(readValue('{"a":{}}', 1), undefined);
  assert.equal(readValue('[1,[2]]', 1), undefined);
  assert.deepEqual(readValue('[[],[]]', 2), [[], []]);
  assert.deepEqual(readValue('[{},{}]', 2), [{}, {}]);
});

test(holds('reader.being-side', 'json: a being is never handed repeated keys, lone surrogates, or numbers a double changes'), () => {
  for (const text of ['{"a":{"b":1,"b":2}}', '"\\ud800"', '{"\\udc00":1}', '1e400', '-0', '9007199254740993', '1e-400', '1 x', '[] []']) {
    assert.equal(readValue(text, 64), undefined, text);
  }
  assert.equal(readValue('"\\ud83d\\ude00"', 64), '😀');
  assert.equal(readValue('9007199254740992', 64), 9007199254740992);
  assert.equal(readValue('0.1', 64), 0.1);
  assert.equal(readValue('-5', 64), -5);
  assert.equal(readValue('1e21', 64), 1e21);
  const numbers: [string, number][] = [
    ['0', 0],
    ['0.00', 0],
    ['0.25', 0.25],
    ['1e+2', 100],
    ['1050e0', 1050],
    ['105e0', 105],
    ['-5e0', -5],
    ['123456789012345680000', 123456789012345680000],
  ];
  for (const [text, n] of numbers) assert.equal(readValue(text, 64), n, text);
});

test('[json] a key named __proto__ is an own key', () => {
  const read = readValue('{"__proto__":{"x":1}}', 64) as Record<string, unknown>;
  assert.ok(Object.hasOwn(read, '__proto__'));
  assert.equal(Object.getPrototypeOf(read), Object.prototype);
  read.__proto__ = 2;
  assert.equal(read.__proto__, 2, 'a key read is a plain property, written and deleted as any');
  delete read.__proto__;
  assert.ok(!Object.hasOwn(read, '__proto__'));
});

test('[json] a value is written only when JSON would read back the same value', () => {
  const own = Object.defineProperty({}, '__proto__', { value: 1, enumerable: true });
  assert.equal(writeValue({ a: [1, 'b', null, true], c: { d: 0.5 } }, 3), '{"a":[1,"b",null,true],"c":{"d":0.5}}');
  assert.equal(writeValue(own, 1), '{"__proto__":1}');
  assert.equal(writeValue(Object.create(null) as object, 1), '{}');
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const shared = { x: 1 };
  assert.equal(writeValue({ a: shared, b: shared }, 2), '{"a":{"x":1},"b":{"x":1}}');
  for (const bad of [undefined, NaN, Infinity, -0, () => 1, Symbol('s'), 1n, new Date(), new Map(), new Array(2), { a: undefined }, '\ud800', { '\udc00': 1 }, cycle, { [Symbol('k')]: 1 }, Object.defineProperty({}, 'g', { get: () => 1, enumerable: true })]) {
    assert.equal(writeValue(bad, 64), undefined, String(bad));
  }
  assert.equal(writeValue(cycle, Infinity), undefined, 'a cycle is refused by its path, not by the depth');
  assert.equal(writeValue([[1]], 1), undefined);
  assert.equal(writeValue([[1]], 2), '[[1]]');
});

test('[json] a count number has no sign, fraction or exponent, and runs from 1 to 2^53 - 1', () => {
  for (const yes of ['1', '42', '9007199254740991']) assert.ok(isCount(yes), yes);
  for (const no of ['0', '-1', '1.0', '1e0', '01', '9007199254740992', '"1"', ' 1']) assert.ok(!isCount(no), no);
});
