// The unlock contract's one suite, run against every body of it. `make`
// opens an unlock on the same storage each time, as a ground does when it
// starts again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Unlock } from 'nervur';

export const unlockSuite = (name: string, make: () => Unlock | Promise<Unlock>) => {
  test(`${name}: it answers one key of sixty-four lowercase hex digits, and the same once it opens again`, async () => {
    const unlock = await make();
    const key = await unlock.key();
    assert.match(key, /^[0-9a-f]{64}$/);
    assert.equal(await unlock.key(), key);
    assert.equal(await (await make()).key(), key, 'the key is kept where it keeps keys');
  });

  test(`${name}: two first uses at once answer one key`, async () => {
    const unlock = await make();
    const [one, two] = await Promise.all([unlock.key(), unlock.key()]);
    assert.equal(one, two);
  });
};
