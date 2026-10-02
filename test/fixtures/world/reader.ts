// A being that reads a counter she was introduced to, awaiting it.
import { Being, s, need, type Args } from 'nervur/being';

export const Peek = need('counter', { peek: { result: s.number(), idempotent: true } });

export class Reader extends Being.of({
  kind: 'org.example.reader',
  cells: { seen: 0 },
  asks: {
    look: { args: s.object({ at: s.string() }), result: s.number(), idempotent: true },
    lookAway: { args: s.object({ at: s.string() }), result: s.number(), idempotent: true },
    holding: { readOnly: true, result: s.array(s.string()) },
  },
}) {
  // Her standings as she lists them, her steward's aside.
  holding() {
    return this.standings
      .list()
      .map(({ id }: { id: string }) => id)
      .filter((id: string) => id !== 'steward');
  }

  async look({ at }: Args<Reader, 'look'>) {
    const { result, error } = await this.held(at, Peek).peek({});
    if (error) this.fail(error.message);
    this.cells.seen = result;
    return this.cells.seen;
  }

  async lookAway({ at }: Args<Reader, 'lookAway'>) {
    const { result, error } = await this.held(at, Peek).peek({});
    return error ? -1 : result;
  }
}
