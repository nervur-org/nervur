// A being with an awaited call and an effect on one need, and no state.
import { Being, s, need, type Args } from 'nervur/being';

export const Fx = need('fx', {
  rate: { args: s.object({ pair: s.string() }), result: s.object({ rate: s.number() }), readOnly: true },
  book: { args: s.object({ pair: s.string(), amount: s.number() }) },
});

export class Clocked extends Being.of({
  kind: 'org.example.clocked',
  needs: { fx: Fx },
  cells: { last: 0 },
  asks: {
    quote: { args: s.object({ pair: s.string() }), result: s.object({ rate: s.number() }), idempotent: true },
    booked: { for: 'fx', args: s.reply(Fx.book) },
  },
}) {
  async quote({ pair }: Args<Clocked, 'quote'>) {
    const { rate } = this.must(await this.fx.rate({ pair }));
    this.cells.last = rate;
    this.fx.book({ pair, amount: rate }, { reply: 'booked' });
    return { rate };
  }

  booked() {}
}
