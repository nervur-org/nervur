import assert from 'node:assert/strict';
import { test } from 'node:test';
import { s } from 'nervur/being';
import { outside } from '../../../src/being/schema.ts';

test('One builder gives the schema and the type', () => {
  assert.deepEqual(s.object({ sku: s.string({ minLength: 1 }), note: s.optional(s.string()), price: s.number({ minimum: 0 }) }), {
    type: 'object',
    properties: { sku: { type: 'string', minLength: 1 }, note: { type: 'string' }, price: { type: 'number', minimum: 0 } },
    required: ['sku', 'price'],
    additionalProperties: false,
  });
  assert.deepEqual(s.array(s.integer()), { type: 'array', items: { type: 'integer' } });
  assert.deepEqual(s.enum(['a', 'b']), { enum: ['a', 'b'] });
  assert.deepEqual(s.const(null), { const: null });
  assert.deepEqual(s.boolean(), { type: 'boolean' });
});

test('It refuses a schema keyword outside the subset: the subset the house checks is closed', () => {
  const written = [
    s.object({ a: s.optional(s.bytes({ maxLength: 64 })), b: s.handle(), c: s.invitation(), d: s.enum([1, 'x', true, null]) }),
    s.reply({ result: s.object({ pending: s.boolean() }) }),
    s.reply({}),
    s.string({ pattern: '^[a-z]+$' }),
  ];
  for (const schema of written) assert.deepEqual(outside(schema), []);
  assert.deepEqual(outside({ type: 'string', format: 'email' }), ['the schema names format, outside the subset']);
  assert.deepEqual(outside({ type: 'string', contentEncoding: 'base64' }), ['the schema has a contentEncoding other than base16']);
  assert.deepEqual(outside({ type: 'string', contentEncoding: 'base16', contentMediaType: 'text/plain' }), ['the schema has a contentMediaType that is not a mark']);
  assert.deepEqual(outside({ type: 'string', pattern: '(' }), ['the schema has a pattern that does not compile']);
  assert.deepEqual(outside({ type: 'object', properties: { a: { $ref: '#' } } }), ['the schema.a names $ref, outside the subset']);
  assert.deepEqual(outside({ type: 'date' }), ['the schema has a type the subset does not name']);
  assert.deepEqual(outside({ anyOf: [] }), ['the schema has an anyOf that is not a list of schemas']);
  assert.deepEqual(outside({ const: { a: 1 } }), ['the schema has a const that is not a scalar']);
});

test('Bytes are a Uint8Array in the process and lowercase hex across a door', () => {
  assert.deepEqual(s.bytes(), { type: 'string', contentEncoding: 'base16' });
  assert.deepEqual(s.bytes({ maxLength: 32 }), { type: 'string', contentEncoding: 'base16', maxLength: 64 }, 'lengths count bytes');
});

test('A handle and an invitation are hex strings with a mark', () => {
  assert.deepEqual(s.handle(), { type: 'string', contentEncoding: 'base16', contentMediaType: 'application/vnd.nervur.handle' });
  assert.deepEqual(s.invitation(), { type: 'string', contentEncoding: 'base16', contentMediaType: 'application/vnd.nervur.invitation' });
});

test('s.reply(method) is the args of a reply', () => {
  const error = s.object({ error: s.object({ message: s.string() }) });
  assert.deepEqual(s.reply({ result: s.number() }), { anyOf: [s.object({ result: s.number() }), error] });
  assert.deepEqual(s.reply({}), { anyOf: [s.object({ result: s.const(null) }), error] }, 'a method with no result answers { result: null }');
});

test('A schema is frozen, so no author changes it after the house read it', () => {
  const schema = s.object({ a: s.string() });
  assert.ok(Object.isFrozen(schema) && Object.isFrozen(schema.properties));
});
