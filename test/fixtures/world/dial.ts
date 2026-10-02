// A dial: a being who watches a faculty's readOnly level, holding the
// level she last read, and a meter the test turns, which answers a watch
// once its level differs.
import { Being, need, s, type Args } from 'nervur/being';
import type { FacultyContext } from 'nervur';

/** A faculty with one level to read, and watch. */
export const Level = need('level', { read: { readOnly: true, result: s.integer() } });

export class Dial extends Being.of({
  kind: 'org.example.dial',
  needs: { level: Level },
  asks: {
    follow: { readOnly: true, args: s.object({ held: s.integer() }), result: s.integer() },
  },
}) {
  async follow({ held }: Args<Dial, 'follow'>) {
    return this.must(await this.level.read({}, { after: held }));
  }
}

/** The meter: `turn` sets its level and answers every watch the level now differs from. */
export const meter = () => {
  let level = 0;
  const waiting: (() => void)[] = [];
  return {
    object: {
      read: async (_args: unknown, context: FacultyContext) => {
        while (context.watch !== undefined && (await context.watch.same({ result: level }))) await new Promise<void>((moved) => waiting.push(moved));
        return { result: level };
      },
    },
    turn: (to: number) => {
      level = to;
      for (const moved of waiting.splice(0)) moved();
    },
  };
};
