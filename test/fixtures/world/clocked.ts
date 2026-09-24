// A being with an awaited call and an effect on one need, and no state.
import { Being, s, need, type Args } from 'nervur/being';

export const Fx = need('fx', {
  rate: { args: s.object({ pair: s.string() }), result: s.object({ rate: s.number() }), hints: { readOnly: true } },
  book: { args: s.object({ pair: s.string(), amount: s.number() }) },
});

export class Clocked extends Being.of({
  kind: 'org.example.clocked',
  needs: { fx: Fx },
  cells: { last: 0 },
  asks: {
    quote: { args: s.object({ pair: s.string() }), result: s.object({ rate: s.number() }), hints: { idempotent: true } },
    booked: { args: s.reply(Fx.book) },
  },
}) {
  async quote({ pair }: Args<Clocked, 'quote'>) {
    const { rate } = await this.fx.rate({ pair });
    this.cells.last = rate;
    this.fx.book({ pair, amount: rate }, { reply: 'booked' });
    return { rate };
  }

  booked() {}
}
