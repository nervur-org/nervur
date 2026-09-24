// classes/order.ts
import { Being, s, need, type Args } from 'nervur/being';

export const Payments = need('payments', {
  charge: {
    args: s.object({ order: s.string(), amount: s.number(), notify: s.handle() }),
    result: s.object({ pending: s.boolean() }),
  },
});

export const Courier = need('courier', {
  pickup: { args: s.object({ items: s.array(s.string()) }) },
});

export class Order extends Being.of({
  kind: 'com.acme.order',
  description: 'One order, from its first item to its shipping.',
  needs: { pay: Payments },
  cells: {
    items: [] as string[],
    total: 0,
    state: 'open',
    paidAt: 0,
    courier: '',
  },
  roles: { owner: (asker) => asker.steward.owner === true },
  state: (me) => me.cells.state,
  asks: {
    hire: {
      for: 'steward',
      hints: { idempotent: true },
      args: s.object({ courier: s.handle() }),
      result: s.string(),
    },
    add: {
      in: 'open',
      for: 'owner',
      to: 'open',
      args: s.object({ sku: s.string(), price: s.number() }),
      result: s.object({ total: s.number() }),
    },
    checkout: { in: 'open', for: 'owner', to: 'paying' },
    charged: { in: 'paying', args: s.reply(Payments.charge), to: ['paying', 'open'] },
    settled: { in: 'paying', for: 'handle', to: 'paid' },
    ship: { in: 'paid', for: 'owner', to: 'shipped' },
  },
}) {
  // The courier's invitation arrives as her standing. The same one twice is the same standing.
  hire({ courier }: Args<Order, 'hire'>) {
    this.cells.courier = courier;
    return courier;
  }

  add({ sku, price }: Args<Order, 'add'>) {
    this.cells.items = [...this.cells.items, sku];
    this.cells.total += price;
    return { total: this.cells.total };
  }

  checkout() {
    if (this.cells.items.length === 0) this.fail('Add an item first.');
    const notify = this.handle('settled', { once: true });
    this.pay.charge({ order: this.id, amount: this.cells.total, notify }, { reply: 'charged' });
    this.cells.state = 'paying';
  }

  charged({ error }: Args<Order, 'charged'>) {
    if (error) this.cells.state = 'open';
  }

  settled() {
    this.cells.state = 'paid';
    this.cells.paidAt = this.house.now();
  }

  ship() {
    if (this.cells.courier === '') this.fail('Hire a courier first.');
    this.held(this.cells.courier, Courier).pickup({ items: this.cells.items });
    this.cells.state = 'shipped';
  }
}
