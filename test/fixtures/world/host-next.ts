// Bob's next version: the same kind, so the same rows, and a new greeting.
import { Being, s } from 'nervur/being';
import { Steward } from './steward.ts';

export class HostNext extends Being.of({
  kind: 'org.example.host',
  cells: { doors: 0 },
  asks: {
    greet: { hints: { readOnly: true }, result: s.string() },
  },
}) {
  greet() {
    return `${this.id} welcomes ${this.asker.id}`;
  }
}

export const steward = Steward;
export const beings = [HostNext];
