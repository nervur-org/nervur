// SPDX-License-Identifier: Apache-2.0
// Letting the bench go idle. The fakes do no I/O, so every ask, effect and
// reply they started runs on the event loop, and the one thing that leaves
// it is WebCrypto, which runs on the engine's own threads and outlasts any
// count of turns on a loaded machine. So the bench counts WebCrypto calls
// in flight, at `crypto.subtle` itself, the one door every body's crypto
// passes, and calls the loop idle only once none has been in flight for a
// run of turns. It counts in the process that imports the bench alone.

// Turns with nothing in flight before the bench calls the loop idle: the
// promise chains between two crypto calls resolve well within them.
const QUIET = 20;
// A loop that never goes idle is a fault the bench names, never a hang.
const BOUND = 200_000;

let inFlight = 0;

const METHODS = ['digest', 'importKey', 'exportKey', 'deriveBits', 'deriveKey', 'encrypt', 'decrypt', 'sign', 'verify', 'generateKey', 'wrapKey', 'unwrapKey'] as const;

// Each method of the engine's `subtle`, counted while its promise is open. Wrapped once, however often the bench loads.
const subtle = globalThis.crypto?.subtle as unknown as Record<string, unknown> & { [COUNTED]?: true };
const COUNTED = Symbol.for('nervur.bench.counted');
if (subtle !== undefined && subtle[COUNTED] !== true) {
  for (const method of METHODS) {
    const original = subtle[method];
    if (typeof original !== 'function') continue;
    subtle[method] = (...args: unknown[]) => {
      inFlight++;
      const done = () => {
        inFlight--;
      };
      const called = (original as (...values: unknown[]) => Promise<unknown>).apply(globalThis.crypto.subtle, args);
      void called.then(done, done);
      return called;
    };
  }
  subtle[COUNTED] = true;
}

// One turn of the event loop: an immediate where the engine has one, else the shortest timer.
const turnOnce: (next: () => void) => void =
  typeof (globalThis as { setImmediate?: unknown }).setImmediate === 'function'
    ? (next) => (globalThis as unknown as { setImmediate: (next: () => void) => void }).setImmediate(next)
    : (next) => setTimeout(next, 0);

/** Every ask, effect and reply the fakes started, run to where it waits on the clock or ends. */
export const settle = async (): Promise<void> => {
  let quiet = 0;
  for (let turn = 0; quiet < QUIET; turn++) {
    if (turn >= BOUND) throw new Error('the bench never went idle: crypto stayed in flight');
    await new Promise<void>((next) => turnOnce(next));
    quiet = inFlight === 0 ? quiet + 1 : 0;
  }
};
