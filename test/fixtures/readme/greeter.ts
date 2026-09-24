// greeter.ts
import { Being, s, type Args } from 'nervur/being';

export class Greeter extends Being.of({
  kind: 'org.example.greeter',
  description: 'Greets whoever asks, and counts them.',
  cells: { greeted: 0 },
  asks: {
    hello: {
      args: s.object({ name: s.string() }),
      result: s.string(),
      examples: [{ cells: { greeted: 2 }, args: { name: 'Ada' }, gives: { result: 'Hello, Ada. You are number 3.' } }],
    },
  },
}) {
  hello({ name }: Args<Greeter, 'hello'>) {
    this.cells.greeted += 1;
    return `Hello, ${name}. You are number ${this.cells.greeted}.`;
  }
}
