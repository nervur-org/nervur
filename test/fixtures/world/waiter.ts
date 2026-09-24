// A being that awaits a faculty which never answers, within her own wait.
import { Being, s, need } from 'nervur/being';

export const Slow = need('slow', { hang: { hints: { readOnly: true }, wait: 500 } });

export class Waiter extends Being.of({
  kind: 'org.example.waiter',
  needs: { slow: Slow },
  asks: {
    poke: { hints: { idempotent: true }, wait: 2000, result: s.string() },
  },
}) {
  async poke() {
    try {
      await this.slow.hang({});
      return 'answered';
    } catch {
      return 'gave up';
    }
  }
}

/** The faculty: its one method never answers. */
export const hanging = { hang: () => new Promise(() => undefined) };
