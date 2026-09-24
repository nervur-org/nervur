// SPDX-License-Identifier: Apache-2.0
// The platform's time and its timers, as every web engine and Node give them.
import type { Clock } from '../foundation.ts';

// A timer holds at most this long; a longer wait is a chain of them.
const LONGEST = 2 ** 31 - 1;

export class WebClock implements Clock {
  readonly #waits = new Map<string, { timer: ReturnType<typeof setTimeout>; resolve: (fired: boolean) => void }>();

  now(): number {
    return Date.now();
  }

  wait({ id, ms }: { id: string; ms: number }): Promise<boolean> {
    this.cancel({ id });
    const at = Date.now() + Math.max(0, ms);
    return new Promise((resolve) => {
      const arm = () => {
        const left = at - Date.now();
        const timer = setTimeout(
          () => {
            if (at > Date.now()) return arm();
            this.#waits.delete(id);
            resolve(true);
          },
          Math.min(Math.max(0, left), LONGEST),
        );
        this.#waits.set(id, { timer, resolve });
      };
      arm();
    });
  }

  cancel({ id }: { id: string }): void {
    const held = this.#waits.get(id);
    if (held === undefined) return;
    clearTimeout(held.timer);
    this.#waits.delete(id);
    held.resolve(false);
  }
}
