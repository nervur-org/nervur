// SPDX-License-Identifier: Apache-2.0
// A clock the test moves. Nothing waits on real time.
import type { Clock } from '../foundation.ts';

interface Waiting {
  readonly at: number;
  readonly resolve: (fired: boolean) => void;
}

export class FakeClock implements Clock {
  #now: number;
  readonly #waits = new Map<string, Waiting>();

  constructor(start = Date.UTC(2026, 0, 1)) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  wait({ id, ms }: { id: string; ms: number }): Promise<boolean> {
    this.#waits.get(id)?.resolve(false);
    return new Promise((resolve) => {
      this.#waits.set(id, { at: this.#now + Math.max(0, ms), resolve });
    });
  }

  cancel({ id }: { id: string }): void {
    this.#waits.get(id)?.resolve(false);
    this.#waits.delete(id);
  }

  /** The time moved on, and every wait it passes fired, earliest first. */
  advance(ms: number): void {
    this.#now += ms;
    const due = [...this.#waits].filter(([, waiting]) => waiting.at <= this.#now).sort(([, a], [, b]) => a.at - b.at);
    for (const [id, waiting] of due) {
      this.#waits.delete(id);
      waiting.resolve(true);
    }
  }

  /** The time of the earliest wait, or `null`. */
  next(): number | null {
    const times = [...this.#waits.values()].map((waiting) => waiting.at);
    return times.length === 0 ? null : Math.min(...times);
  }
}
