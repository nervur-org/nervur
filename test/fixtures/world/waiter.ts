// A being that awaits a faculty which never answers, within her own wait.
import { Being, s, need } from 'nervur/being';

export const Slow = need('slow', { hang: { readOnly: true, wait: 500 } });

export class Waiter extends Being.of({
  kind: 'org.example.waiter',
  needs: { slow: Slow },
  asks: {
    poke: { idempotent: true, wait: 2000, result: s.string() },
  },
}) {
  async poke() {
    const { error } = await this.slow.hang({});
    return error ? 'gave up' : 'answered';
  }
}

/** The faculty: its one method never answers. */
export const hanging = { hang: () => new Promise(() => undefined) };
