// The onion's house code: its steward, and a peeler who greets through the
// leaf at the top of the ladder, and counts each greeting in her cells.
import { Being, s, type Args } from 'nervur/being';
import { Leaf } from '../rungs.ts';

export { Steward as steward } from '../../world/steward.ts';

export class Peeler extends Being.of({
  kind: 'org.example.peeler',
  needs: { leaf: Leaf },
  cells: { count: 0 },
  asks: {
    greet: { args: s.object({ name: s.string() }), result: s.string(), hints: { idempotent: true } },
    hello: { args: s.object({ name: s.string() }), result: s.string(), hints: { readOnly: true } },
  },
}) {
  async greet({ name }: Args<Peeler, 'greet'>) {
    this.cells.count += 1;
    return `${await this.leaf.greet({ name })} #${this.cells.count}`;
  }

  async hello({ name }: Args<Peeler, 'hello'>) {
    return `${await this.leaf.greet({ name })} after ${this.cells.count}`;
  }
}

export const beings = [Peeler];
