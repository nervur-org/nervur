// The custody contract's one suite, run against every body of it. `make`
// opens a custody on the same storage each time, as a ground does when it
// starts again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Custody } from 'nervur';

export const custodySuite = (name: string, make: () => Custody | Promise<Custody>) => {
  const wardOf = async (custody: Custody, house: string) => (await custody.keys({ house })).ward();

  test(`${name}: a house's keys answer one ward, and the same once it opens again`, async () => {
    const custody = await make();
    const ward = await wardOf(custody, 'shop');
    assert.deepEqual(await wardOf(custody, 'shop'), ward);
    assert.deepEqual(await wardOf(await make(), 'shop'), ward, 'its seed is kept where it keeps seeds');
  });

  test(`${name}: two houses hold two wards`, async () => {
    const custody = await make();
    const [shop, home] = await Promise.all([wardOf(custody, 'shop'), wardOf(custody, 'home')]);
    assert.notDeepEqual(shop.signing, home.signing);
  });

  test(`${name}: a house's seed kept under another name answers the same ward, as a move brings it`, async () => {
    const custody = await make();
    assert.ok(custody.seed !== undefined && custody.keep !== undefined, 'a shipped custody moves houses');
    const seed = await custody.seed({ house: 'leaving' });
    assert.match(seed, /^[0-9a-f]{64}$/);
    assert.equal(await custody.seed({ house: 'leaving' }), seed, 'the same seed each time');
    await custody.keep({ house: 'arrived', seed });
    await custody.keep({ house: 'arrived', seed });
    assert.deepEqual(await wardOf(custody, 'arrived'), await wardOf(custody, 'leaving'));
  });

  test(`${name}: a house that holds a seed keeps no other`, async () => {
    const custody = await make();
    const seed = await custody.seed!({ house: 'held' });
    const other = seed.startsWith('0') ? `1${seed.slice(1)}` : `0${seed.slice(1)}`;
    await assert.rejects(async () => custody.keep!({ house: 'held', seed: other }), /another seed/);
    await assert.rejects(async () => custody.keep!({ house: 'fresh', seed: 'not a seed' }), /sixty-four/);
  });

  test(`${name}: a house whose name leaves the rule is refused`, async () => {
    const custody = await make();
    await assert.rejects(async () => wardOf(custody, '../seeds'), /no house is named/);
  });
};
