// The tools contract's one suite, run against every body of it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tools } from '../../../src/foundation.ts';

export const toolsSuite = (name: string, make: () => Tools) => {
  const tools = make();

  test(`${name}: UTF-8 is read fatally, and a byte order mark is no whitespace`, () => {
    assert.equal(tools.text(tools.utf8('é')), 'é');
    assert.equal(tools.text(new Uint8Array([0xc3])), null);
    assert.equal(tools.text(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), '﻿{}');
    assert.equal(tools.parse('﻿{}'), null);
  });

  test(`${name}: hex is lowercase and whole`, () => {
    assert.equal(tools.hex(new Uint8Array([0, 171, 255])), '00abff');
    assert.deepEqual(tools.bytes('00abff'), new Uint8Array([0, 171, 255]));
    assert.equal(tools.bytes('00ABFF'), null);
    assert.equal(tools.bytes('abc'), null);
  });

  test(`${name}: JSON is read as RFC 8259 writes it`, () => {
    for (const text of ['{', '{"a":1,}', '[1,]', '01', '1.', '.5', '"\t"', '"\\x"', 'tru', '{"a" 1}', '1 2', "{'a':1}", 'NaN']) assert.equal(tools.parse(text), null, text);
    for (const text of ['-0', '1e400', '9007199254740993', ' [ ] ', '"\\ud800"', '{"a":{"b":[true,false,null]}}']) assert.notEqual(tools.parse(text), null, text);
  });

  test(`${name}: every own key is kept apart, and its value's text kept as written`, () => {
    const parsed = tools.parse(' { "seq" : 1.0 , "args":{"x":[1, 2]} } ')!;
    assert.deepEqual({ ...parsed.fields }, { seq: '1.0', args: '{"x":[1, 2]}' });
    assert.equal(parsed.duplicate, false);
    assert.equal(tools.parse('{"a":1,"\\u0061":2}')!.duplicate, true, 'a key and its escape are one name');
    const nested = tools.parse('{"a":{"b":1,"b":2}}')!;
    assert.equal(nested.duplicate, false);
    assert.equal(nested.nestedDuplicate, true);
    assert.equal(tools.parse('[1]')!.fields, null);
    assert.deepEqual(Object.keys(tools.parse('{"__proto__":1}')!.value as object), ['__proto__']);
  });

  test(`${name}: no nesting exhausts the reader`, () => {
    const deep = `${'['.repeat(200_000)}${']'.repeat(200_000)}`;
    assert.notEqual(tools.parse(deep), null);
  });

  test(`${name}: one canonical spelling`, () => {
    assert.equal(tools.canonical({ b: [1, { d: null, c: 'x' }], a: true }), '{"a":true,"b":[1,{"c":"x","d":null}]}');
    assert.throws(() => tools.canonical({ a: Number.NaN }));
    assert.throws(() => tools.canonical(new Date()));
  });
};
