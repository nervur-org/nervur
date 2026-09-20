// SPDX-License-Identifier: Apache-2.0
// The allowance: how long a being waits on one ask. It is on no wire. A
// being who says nothing gets the default, and nobody gets past the
// ceiling.
import type { Clock } from '../contract/index.ts';
import type { Wanted } from '../being/index.ts';

export const DEFAULT = 30_000;
export const CEILING = 300_000;

export const allow = (wanted: Wanted | undefined): number => {
  const whole = typeof wanted?.time === 'number' ? Math.floor(wanted.time) : NaN;
  return Math.min(Number.isFinite(whole) && whole > 0 ? whole : DEFAULT, CEILING);
};

export const LATE: unique symbol = Symbol('late');
export type Late = typeof LATE;

// One ask's bell. It bounds the wait of the being who asked and the send
// that holds the relation's line, so a far side that never answers holds
// neither for longer than the allowance.
export class Bell {
  readonly #wait: { done: Promise<void>; cancel(): void };
  readonly #late: Promise<Late>;
  #rang = false;

  constructor(clock: Clock, ms: number) {
    this.#wait = clock.wait(ms);
    this.#late = this.#wait.done.then((): Late => {
      this.#rang = true;
      return LATE;
    });
  }

  get rang(): boolean {
    return this.#rang;
  }

  race<T>(work: Promise<T>): Promise<T | Late> {
    work.catch(() => {});
    return Promise.race([work, this.#late]);
  }

  cancel(): void {
    this.#wait.cancel();
  }
}
