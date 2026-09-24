// greeter.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Greeter } from './greeter.ts';

test('Greeter keeps her examples and her table', async () => {
  await Bench.check(Greeter);
});

test('Greeter counts whoever she greets', async () => {
  const bench = await Bench.open({ classes: [Greeter] });
  const greeter = await bench.place(Greeter);
  assert.deepEqual(await greeter.ask('hello', { name: 'Ada' }), { result: 'Hello, Ada. You are number 1.' });
  assert.deepEqual(await greeter.cells(), { greeted: 1 });
});
