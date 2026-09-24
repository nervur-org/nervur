// The memory contract's one suite, run against every body of it. `make`
// gives an empty memory each time.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Memory } from '../../../src/foundation.ts';

const bytes = (...values: number[]) => new Uint8Array(values);

export const memorySuite = (name: string, make: () => Promise<Memory> | Memory) => {
  test(`${name}: an empty memory lists nothing and reads every place absent`, async () => {
    const memory = await make();
    assert.deepEqual(await memory.list(), []);
    assert.deepEqual(await memory.read({ place: 'p' }), { entries: {}, version: null });
  });

  test(`${name}: a write lands every place it names, and answers their versions`, async () => {
    const memory = await make();
    const versions = await memory.write({ writes: { p: { a: bytes(1) }, q: { b: bytes(2) } }, expect: { p: null, q: null } });
    assert.ok(versions !== null && typeof versions.p === 'string' && typeof versions.q === 'string');
    const read = await memory.read({ place: 'p' });
    assert.deepEqual(read, { entries: { a: bytes(1) }, version: versions.p });
    assert.deepEqual([...(await memory.list())].sort(), ['p', 'q']);
  });

  test(`${name}: a write whose versions moved is refused, and nothing of it lands`, async () => {
    const memory = await make();
    const first = (await memory.write({ writes: { p: { a: bytes(1) } }, expect: { p: null } }))!;
    assert.equal(await memory.write({ writes: { p: { a: bytes(2) }, q: { b: bytes(3) } }, expect: { p: null, q: null } }), null);
    assert.deepEqual(await memory.read({ place: 'q' }), { entries: {}, version: null }, 'the other place did not land');
    const second = await memory.write({ writes: { p: { a: bytes(2) } }, expect: { p: first.p! } });
    assert.ok(second !== null && second.p !== first.p, 'a version moves on every write that touches its place');
  });

  test(`${name}: a place expected and not written is held to its version too`, async () => {
    const memory = await make();
    const landed = (await memory.write({ writes: { p: { a: bytes(1) } }, expect: { p: null } }))!;
    await memory.write({ writes: { p: { a: bytes(9) } }, expect: { p: landed.p! } });
    assert.equal(await memory.write({ writes: { q: { b: bytes(1) } }, expect: { q: null, p: landed.p! } }), null);
  });

  test(`${name}: an entry of null is removed, and a place with no entry is absent`, async () => {
    const memory = await make();
    const landed = (await memory.write({ writes: { p: { a: bytes(1), b: bytes(2) } }, expect: { p: null } }))!;
    const next = (await memory.write({ writes: { p: { a: null } }, expect: { p: landed.p! } }))!;
    assert.deepEqual((await memory.read({ place: 'p' })).entries, { b: bytes(2) });
    await memory.write({ writes: { p: { b: null } }, expect: { p: next.p! } });
    assert.deepEqual(await memory.read({ place: 'p' }), { entries: {}, version: null });
    assert.deepEqual(await memory.list(), []);
  });

  test(`${name}: what is written is kept as it was written`, async () => {
    const memory = await make();
    const written = bytes(1, 2, 3);
    await memory.write({ writes: { p: { a: written } }, expect: { p: null } });
    written[0] = 9;
    assert.deepEqual((await memory.read({ place: 'p' })).entries.a, bytes(1, 2, 3));
  });
};
