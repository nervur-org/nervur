// A being that reads a counter she was introduced to, awaiting it.
import { Being, s, need, type Args } from 'nervur/being';

export const Peek = need('counter', { peek: { result: s.number(), hints: { idempotent: true } } });

export class Reader extends Being.of({
  kind: 'org.example.reader',
  cells: { seen: 0 },
  asks: {
    look: { args: s.object({ at: s.string() }), result: s.number(), hints: { idempotent: true } },
    lookAway: { args: s.object({ at: s.string() }), result: s.number(), hints: { idempotent: true } },
  },
}) {
  async look({ at }: Args<Reader, 'look'>) {
    this.cells.seen = await this.held(at, Peek).peek({});
    return this.cells.seen;
  }

  async lookAway({ at }: Args<Reader, 'lookAway'>) {
    try {
      return await this.held(at, Peek).peek({});
    } catch {
      return -1;
    }
  }
}
