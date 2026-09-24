// The paper's checkout, piloted by her steward: a charge sent as an effect
// with a handle, its answer back through a reply, and the money settled
// through the handle.
import { Being, s, type Args } from 'nervur/being';
import { Payments } from '../guides/classes/order.ts';

export class Checkout extends Being.of({
  kind: 'org.example.shop',
  needs: { pay: Payments },
  cells: { state: 'open', refused: '' },
  state: (me) => me.cells.state,
  asks: {
    checkout: { in: 'open', to: 'paying', args: s.object({ amount: s.number() }) },
    charged: { in: 'paying', args: s.reply(Payments.charge), to: ['paying', 'open'] },
    settled: { in: 'paying', for: 'handle', to: 'paid' },
    cancel: { in: 'paying', to: 'open' },
    status: { hints: { readOnly: true }, result: s.object({ state: s.string(), refused: s.string() }) },
  },
}) {
  checkout({ amount }: Args<Checkout, 'checkout'>) {
    const notify = this.handle('settled', { once: true });
    this.pay.charge({ order: this.id, amount, notify }, { reply: 'charged' });
    this.cells.state = 'paying';
  }

  charged({ error }: Args<Checkout, 'charged'>) {
    if (error) {
      this.cells.state = 'open';
      this.cells.refused = error.message;
    }
  }

  settled() {
    this.cells.state = 'paid';
  }

  cancel() {
    this.cells.state = 'open';
  }

  status() {
    return { state: this.cells.state, refused: this.cells.refused };
  }
}
