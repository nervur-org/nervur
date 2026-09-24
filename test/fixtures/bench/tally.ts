// A class whose documentation is its examples, and one that is not the same twice.
import { Being, s, type Args } from 'nervur/being';

export class Tally extends Being.of({
  kind: 'org.example.tally',
  cells: { count: 0, state: 'counting' },
  state: (me) => me.cells.state,
  roles: { keeper: (asker) => asker.notes.keeper === true },
  asks: {
    bump: {
      in: 'counting',
      for: 'keeper',
      args: s.object({ by: s.number() }),
      result: s.number(),
      examples: [
        { description: 'adds to what stands', cells: { count: 2 }, args: { by: 3 }, gives: { result: 5 } },
        { description: 'refuses to go down', args: { by: -1 }, gives: { error: { message: 'by is negative' } } },
      ],
    },
    stop: { in: 'counting', for: 'keeper', to: 'stopped', examples: [{ gives: { result: null } }] },
    read: { hints: { readOnly: true }, result: s.number(), examples: [{ cells: { count: 7, state: 'stopped' }, gives: { result: 7 } }] },
  },
}) {
  bump({ by }: Args<Tally, 'bump'>) {
    if (by < 0) this.fail('by is negative');
    this.cells.count += by;
    return this.cells.count;
  }

  stop() {
    this.cells.state = 'stopped';
  }

  read() {
    return this.cells.count;
  }
}

export class Dice extends Being.of({
  kind: 'org.example.dice',
  asks: { roll: { result: s.number(), examples: [{ description: 'any face' }] } },
}) {
  roll() {
    return Math.floor(Math.random() * 1_000_000);
  }
}

export class Liar extends Being.of({
  kind: 'org.example.liar',
  roles: { friend: (asker) => asker.id === 'nobody' },
  asks: { secret: { for: 'friend', result: s.string(), examples: [{ gives: { result: 'told' } }] } },
}) {
  secret() {
    return 'told';
  }
}
