// A house whose steward misbehaves every way a runner contains: she loops
// without end, writes and then loops, leaves a rejection unawaited, and
// reaches for the globals a house never hands her. She also counts, so a
// test sees the house go on.
import { Being, s } from 'nervur/being';

/** Globals that reach past the house, which no being finds. */
const PLATFORM = ['process', 'require', 'fetch', 'WebSocket', 'XMLHttpRequest', 'importScripts', 'postMessage', 'setTimeout', 'setInterval', 'navigator', 'indexedDB'];

export class Wild extends Being.of({
  kind: 'org.example.wild',
  cells: { count: 0, wrote: false as boolean },
  asks: {
    count: { result: s.integer() },
    loop: { wait: 50 },
    scribble: { wait: 50 },
    stray: { result: s.string() },
    reach: { readOnly: true, result: s.array(s.string()) },
    wrote: { readOnly: true, result: s.boolean() },
  },
}) {
  count() {
    this.cells.count += 1;
    return this.cells.count;
  }

  loop() {
    for (;;) {
      // She never yields.
    }
  }

  scribble() {
    this.cells.wrote = true;
    for (;;) {
      // What she wrote waits on an ask that never ends.
    }
  }

  stray() {
    void Promise.reject(new Error('left unawaited'));
    return 'answered';
  }

  reach() {
    const scope = globalThis as unknown as Record<string, unknown>;
    return PLATFORM.filter((name) => scope[name] !== undefined);
  }

  wrote() {
    return this.cells.wrote;
  }
}

export const steward = Wild;
