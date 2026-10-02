// The runner's one suite, run against every ground that contains its
// houses. `open` gives a house of test/fixtures/runner, whose steward
// misbehaves, asked through its ground's hand as root.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { Json } from 'nervur/being';

type Answer = { readonly result: Json } | { readonly error: { readonly message: string } } | { readonly describe: Json };

/** A contained house, asked as its owner asks it. */
export interface ContainedHouse {
  ask(request: { method: string; args?: Json; call?: string }): Promise<Answer>;
}

const SILENT = { error: { message: 'the house answered nothing' } };

export const runnerSuite = (name: string, open: (t: TestContext) => Promise<ContainedHouse>) => {
  test(`A being that loops without end fails her ask at its wait, and the house goes on: on ${name}`, { timeout: 15_000 }, async (t) => {
    const house = await open(t);
    assert.deepEqual(await house.ask({ method: 'count' }), { result: 1 });
    assert.deepEqual(await house.ask({ method: 'loop' }), SILENT, 'her caller hears silence, as an absent being gives');
    assert.deepEqual(await house.ask({ method: 'count' }), { result: 2 }, 'the house opened again from memory, and what landed stands');
  });

  test(`An ask that held the runner is refused the next time, and nothing it wrote landed: on ${name}`, { timeout: 15_000 }, async (t) => {
    const house = await open(t);
    assert.deepEqual(await house.ask({ method: 'scribble', call: 'once' }), SILENT);
    const refused = { error: { message: 'the ask held its runner past its wait' } };
    assert.deepEqual(await house.ask({ method: 'scribble', call: 'once' }), refused, 'the same ask comes again, and is refused before it runs');
    assert.deepEqual(await house.ask({ method: 'scribble', call: 'once' }), refused, 'the refusal is its answer, kept by its call id');
    assert.deepEqual(await house.ask({ method: 'wrote' }), { result: false }, 'what it wrote before its runner ended never landed');
  });

  test(`A rejection she left unawaited dies in her runner, and the ground stands: on ${name}`, async (t) => {
    const house = await open(t);
    assert.deepEqual(await house.ask({ method: 'stray' }), { result: 'answered' });
    assert.deepEqual(await house.ask({ method: 'count' }), { result: 1 });
    assert.deepEqual(await house.ask({ method: 'stray' }), { result: 'answered' });
    assert.deepEqual(await house.ask({ method: 'count' }), { result: 2 }, 'the house stands, and counts on');
  });

  test(`A global the house did not hand is not there for her: on ${name}`, async (t) => {
    const house = await open(t);
    assert.deepEqual(await house.ask({ method: 'reach' }), { result: [] });
  });
};
