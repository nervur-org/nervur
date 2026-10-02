// SPDX-License-Identifier: Apache-2.0
// Letting the bench go idle. The fakes do no I/O, so every ask, effect and
// reply they started runs on the event loop, and the one thing that leaves
// it is WebCrypto, which runs on the engine's own threads and outlasts any
// count of turns on a loaded machine. So the bench counts WebCrypto calls
// in flight, at `crypto.subtle` itself, the one door every body's crypto
// passes, and calls the loop idle only once none has been in flight for a
// run of turns. It counts in the process that imports the bench alone.

import { engineStart, type Start, type Thread } from '../index.ts';

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

// The loop of this process idle: no crypto in flight for a run of turns.
const quietHere = async (): Promise<void> => {
  let quiet = 0;
  for (let turn = 0; quiet < QUIET; turn++) {
    if (turn >= BOUND) throw new Error('the bench never went idle: crypto stayed in flight');
    await new Promise<void>((next) => turnOnce(next));
    quiet = inFlight === 0 ? quiet + 1 : 0;
  }
};

/** A runner's thread as the bench watches it: the last message sent into it, and the last whose work it said ended. */
interface Watched {
  sent: number;
  done: number;
  readonly idle: (() => void)[];
}

const live = new Set<Watched>();

const wake = (watched: Watched) => {
  for (const idle of watched.idle.splice(0)) idle();
};

/** One engine thread, kept across the houses it runs: each message goes to the house it runs now. */
interface Kept {
  readonly thread: Thread;
  heard: (message: unknown) => void;
  ended: (why: string) => void;
}

// Threads whose house closed whole, which the next house opens on: a test's houses run one after another, on runners the engine has compiled hot.
const spare: Kept[] = [];

const keptThread = (): Kept => {
  const found = spare.pop();
  if (found !== undefined) return found;
  const kept: Kept = { thread: engineStart(), heard: () => undefined, ended: () => undefined };
  kept.thread.listen(
    (message) => kept.heard(message),
    (why) => kept.ended(why),
  );
  return kept;
};

/**
 * A runner's thread on this engine, watched: every house the bench opens
 * runs in one, so a species that loops or throws fails her test there,
 * and the bench waits on the work each message began until it ends. A
 * thread whose house closed whole runs the next house the bench opens.
 */
export const watchedStart: Start = () => {
  const kept = keptThread();
  const thread = kept.thread;
  const watched: Watched = { sent: 0, done: 0, idle: [] };
  let closed = false;
  live.add(watched);
  const gone = () => {
    live.delete(watched);
    wake(watched);
  };
  return {
    post: (message) => {
      const said = message as { t?: unknown; s?: unknown };
      if (typeof said.s === 'number') watched.sent = said.s;
      if (said.t === 'close') closed = true;
      thread.post(message);
    },
    listen: (heard, ended) => {
      kept.heard = (message) => {
        const said = message as { t?: unknown; s?: unknown };
        if (said.t === 'end' && typeof said.s === 'number') {
          watched.done = Math.max(watched.done, said.s);
          if (watched.done >= watched.sent) wake(watched);
        }
        heard(message);
      };
      kept.ended = (why) => {
        gone();
        ended(why);
      };
    },
    end: () => {
      gone();
      kept.heard = () => undefined;
      kept.ended = () => undefined;
      thread.hold?.(false);
      if (closed) spare.push(kept);
      else thread.end();
    },
    ...(thread.hold === undefined ? {} : { hold: (held: boolean) => thread.hold!(held) }),
  };
};

/** Every ask, effect and reply the fakes started, here and in each runner, run to where it waits on the clock or ends. */
export const settle = async (): Promise<void> => {
  for (;;) {
    await quietHere();
    const working = [...live].filter((watched) => watched.done < watched.sent);
    if (working.length === 0) return;
    await Promise.all(working.map((watched) => new Promise<void>((idle) => watched.idle.push(idle))));
  }
};
