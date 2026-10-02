// A class that asks two standings: one her steward introduced, named
// `rates`, and one she takes from an invitation. Each is answered on the
// bench by a stand-in made from her need.
import { Being, need, s, type Args } from 'nervur/being';

export const Rates = need('rates', {
  rate: { idempotent: true, args: s.object({ from: s.string() }), result: s.number() },
  note: { args: s.object({ line: s.string() }) },
});

export class Quote extends Being.of({
  kind: 'org.example.quote',
  cells: { courier: '' },
  asks: {
    price: { for: 'root', idempotent: true, args: s.object({ from: s.string() }), result: s.number() },
    log: { for: 'root', args: s.object({ line: s.string() }) },
    hire: { for: 'root', idempotent: true, args: s.object({ courier: s.handle() }) },
    send: { for: 'root' },
  },
}) {
  async price({ from }: Args<Quote, 'price'>) {
    return this.must(await this.held('rates', Rates).rate({ from }));
  }

  log({ line }: Args<Quote, 'log'>) {
    this.held('rates', Rates).note({ line });
  }

  hire({ courier }: Args<Quote, 'hire'>) {
    this.cells.courier = courier;
  }

  send() {
    if (this.cells.courier === '') this.fail('Hire a courier first.');
    this.held(this.cells.courier, Rates).note({ line: 'sent' });
  }
}
