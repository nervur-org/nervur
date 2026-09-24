// The clock contract's one suite, run against every body of it. `advance`
// moves the body's time by `ms`, however that body's time moves.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Clock } from '../../../src/foundation.ts';

export const clockSuite = (name: string, make: () => { clock: Clock; advance: (ms: number) => Promise<void> }) => {
  test(`${name}: the time is milliseconds since the epoch`, () => {
    const { clock } = make();
    assert.ok(Number.isInteger(clock.now()) && clock.now() > Date.UTC(2020, 0, 1));
  });

  test(`${name}: a wait is true once its time has passed`, async () => {
    const { clock, advance } = make();
    const waited = clock.wait({ id: 'a', ms: 20 });
    await advance(20);
    assert.equal(await waited, true);
  });

  test(`${name}: a second wait under one id replaces the first, and a cancel ends it`, async () => {
    const { clock, advance } = make();
    const first = clock.wait({ id: 'a', ms: 20 });
    const second = clock.wait({ id: 'a', ms: 20 });
    assert.equal(await first, false);
    const other = clock.wait({ id: 'b', ms: 20 });
    clock.cancel({ id: 'b' });
    assert.equal(await other, false);
    await advance(20);
    assert.equal(await second, true);
  });
};
