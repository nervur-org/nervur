// The carry contract's one suite, run against every body of it. `make`
// gives two carries that reach each other and how the second listens, an
// address nothing answers at, and `cut`, which loses the next reply after
// the far door answered, as a network does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Carry } from '../../../src/foundation.ts';

type Door = (box: Uint8Array) => Promise<Uint8Array | null>;

// The ward the second carry answers for, which the suite asks it on.
const WARD = 'ab'.repeat(64);

export interface Made {
  one: Carry;
  two: Carry;
  listen: (listened: { ward: string; door: Door }) => Promise<void>;
  nowhere: string;
  cut: () => Promise<void>;
  /** A second door, listening on the ward at an address of its own, and whether a box reached it. */
  spare: () => Promise<{ at: string; reached: () => boolean }>;
  close: () => Promise<void>;
}

export const carrySuite = (name: string, make: () => Promise<Made>) => {
  test(`${name}: a box reaches the door at an address, and its reply comes back with the address that gave it`, async (t) => {
    const { one, two, listen, close } = await make();
    t.after(close);
    await listen({ ward: WARD, door: async (box) => new Uint8Array([...box].reverse()) });
    const at = two.at({});
    assert.ok(at.length > 0 && at.every((address) => typeof address === 'string'));
    assert.deepEqual(await one.send({ ward: WARD, at, box: new Uint8Array([1, 2, 3]) }), { reply: new Uint8Array([3, 2, 1]), via: at[0] });
  });

  test(`${name}: a box to a ward the carry listens for goes to its door by pointer, with no address dialled`, async (t) => {
    const { two, listen, nowhere, close } = await make();
    t.after(close);
    await listen({ ward: WARD, door: async (box) => new Uint8Array([...box].reverse()) });
    assert.deepEqual(await two.send({ ward: WARD, at: [], box: new Uint8Array([1, 2]) }), { reply: new Uint8Array([2, 1]) }, 'no address at all');
    assert.deepEqual(await two.send({ ward: WARD, at: [nowhere], box: new Uint8Array([3, 4]) }), { reply: new Uint8Array([4, 3]) }, 'an address nothing answers at is never dialled');
    assert.deepEqual(await two.send({ ward: 'cd'.repeat(64), at: [], box: new Uint8Array([1]) }), { reply: null, heard: false }, 'a ward it does not listen for');
  });

  test(`${name}: a door that gives nothing was not delivered to, so it is nothing unheard`, async (t) => {
    const { one, two, listen, close } = await make();
    t.after(close);
    await listen({ ward: WARD, door: async () => null });
    assert.deepEqual(await one.send({ ward: WARD, at: two.at({}), box: new Uint8Array([1]) }), { reply: null, heard: false });
  });

  test(`${name}: no address, or none that answers, is nothing unheard`, async (t) => {
    const { one, nowhere, close } = await make();
    t.after(close);
    assert.deepEqual(await one.send({ ward: WARD, at: [], box: new Uint8Array([1]) }), { reply: null, heard: false });
    assert.deepEqual(await one.send({ ward: WARD, at: [nowhere], box: new Uint8Array([1]) }), { reply: null, heard: false });
    assert.deepEqual(await one.send({ ward: WARD, at: ['no address at all'], box: new Uint8Array([1]) }), { reply: null, heard: false });
  });

  test(`${name}: an address that surely did not hear is passed, and the next that answers gives the reply`, async (t) => {
    const { one, two, listen, nowhere, close } = await make();
    t.after(close);
    await listen({ ward: WARD, door: async () => new Uint8Array([7]) });
    const [live] = two.at({});
    assert.deepEqual(await one.send({ ward: WARD, at: [nowhere, live], box: new Uint8Array([1]) }), { reply: new Uint8Array([7]), via: live });
  });

  test(`${name}: a reply lost after the door answered may have been heard, and goes to no second address`, async (t) => {
    const { one, two, listen, cut, spare, close } = await make();
    t.after(close);
    await listen({
      ward: WARD,
      door: async () => {
        await cut();
        return new Uint8Array([7]);
      },
    });
    const second = await spare();
    assert.deepEqual(await one.send({ ward: WARD, at: [...two.at({}), second.at], box: new Uint8Array([1]) }), { reply: null, heard: true });
    assert.equal(second.reached(), false);
  });
};
