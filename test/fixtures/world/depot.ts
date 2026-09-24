// A courier in a house of its own: whoever holds one of its occupants may
// hand it items to pick up, and its owner reads what was picked.
import { Being, s, type Args } from 'nervur/being';

export class Depot extends Being.of({
  kind: 'com.acme.depot',
  cells: { picked: [] as string[] },
  roles: { client: (asker) => asker.id.startsWith('client-') },
  asks: {
    pickup: { for: 'client', args: s.object({ items: s.array(s.string()) }) },
    picked: { for: 'steward', hints: { readOnly: true }, result: s.array(s.string()) },
  },
}) {
  pickup({ items }: Args<Depot, 'pickup'>) {
    this.cells.picked = [...this.cells.picked, ...items];
  }

  picked() {
    return this.cells.picked;
  }
}
