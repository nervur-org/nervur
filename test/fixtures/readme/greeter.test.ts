// greeter.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Greeter } from './greeter.ts';

// Her module, which the bench loads in the house's own runner.
const module = new URL('./greeter.ts', import.meta.url);

test('Greeter keeps her examples and her table', async () => {
  await Bench.check(Greeter, { module });
});

test('Greeter counts whoever she greets', async () => {
  const bench = await Bench.open({ module });
  const greeter = await bench.place(Greeter);
  assert.deepEqual(await greeter.ask('hello', { name: 'Ada' }), { result: 'Hello, Ada. You are number 1.' });
  assert.deepEqual(await greeter.ask('hello', { name: 'Bo' }), { result: 'Hello, Bo. You are number 2.' });
});
