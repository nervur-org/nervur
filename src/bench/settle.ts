// SPDX-License-Identifier: Apache-2.0
// Letting the bench go idle: the fakes do no I/O, so every ask, effect and
// reply they started runs within a few turns of the event loop.

// The turns the event loop takes before the bench calls a house idle; crypto settles within them.
const TURNS = 60;

// One turn of the event loop: an immediate where the engine has one, else the shortest timer.
const turnOnce: (next: () => void) => void =
  typeof (globalThis as { setImmediate?: unknown }).setImmediate === 'function'
    ? (next) => (globalThis as unknown as { setImmediate: (next: () => void) => void }).setImmediate(next)
    : (next) => setTimeout(next, 0);

/** Every ask, effect and reply the fakes started, run to where it waits on the clock or ends. */
export const settle = async (): Promise<void> => {
  for (let turn = 0; turn < TURNS; turn++) await new Promise<void>((next) => turnOnce(next));
};
