// SPDX-License-Identifier: Apache-2.0
// An edge's clock: every pending wait keeps the Durable Object's one
// platform alarm at the earliest time due, and ends when the alarm fires.
// It holds no timer, so an object with nothing to do but wait may be
// evicted, and the alarm wakes it. A wait lives in the object's memory
// alone: an evicted object's waits are gone, and the houses its ground
// opens again arm them afresh from their rows.
import type { Clock } from '../foundation.ts';
import type { DurableStorage } from './durable.ts';

export class DurableClock implements Clock {
  readonly #storage: DurableStorage;
  readonly #waits = new Map<string, { readonly at: number; readonly resolve: (fired: boolean) => void }>();
  // The alarm as this clock last set or read it; `undefined` until it knows.
  #armed: number | null | undefined;
  #turn: Promise<unknown> = Promise.resolve();

  constructor(storage: DurableStorage) {
    this.#storage = storage;
  }

  now(): number {
    return Date.now();
  }

  wait({ id, ms }: { id: string; ms: number }): Promise<boolean> {
    this.cancel({ id });
    const at = Date.now() + Math.max(0, ms);
    const waited = new Promise<boolean>((resolve) => this.#waits.set(id, { at, resolve }));
    // Storage that refuses the alarm leaves the wait to the next wake, as an eviction would.
    this.#arm(at).catch(() => undefined);
    return waited;
  }

  cancel({ id }: { id: string }): void {
    const held = this.#waits.get(id);
    if (held === undefined) return;
    this.#waits.delete(id);
    held.resolve(false);
  }

  /**
   * The object's alarm fired: every wait due ends, and the alarm is set for
   * the next. The Durable Object's `alarm()` calls it.
   */
  async alarm(): Promise<void> {
    this.#armed = null;
    const now = Date.now();
    let next: number | undefined;
    for (const [id, { at, resolve }] of this.#waits) {
      if (at > now) {
        next = next === undefined ? at : Math.min(next, at);
        continue;
      }
      this.#waits.delete(id);
      resolve(true);
    }
    if (next !== undefined) await this.#arm(next);
  }

  // The alarm moved earlier where `at` comes before it, and never later: a
  // house of an earlier wake may still be owed the time it set.
  #arm(at: number): Promise<void> {
    const turn = this.#turn.then(async () => {
      if (this.#armed === undefined) this.#armed = await this.#storage.getAlarm();
      if (this.#armed !== null && this.#armed <= at) return;
      this.#armed = at;
      await this.#storage.setAlarm(at);
    });
    this.#turn = turn.catch(() => undefined);
    return turn;
  }
}
