// A class whose documentation is its examples, two that are not the same
// twice, one whose role holds on what her history wrote, and one whose
// role no one the bench makes can hold.
import { Being, s, type Args } from 'nervur/being';

export class Tally extends Being.of({
  kind: 'org.example.tally',
  cells: { count: 0, state: 'counting' },
  state: (me) => me.cells.state,
  roles: { keeper: (asker) => asker.steward.keeper === true },
  asks: {
    bump: {
      in: 'counting',
      for: 'keeper',
      args: s.object({ by: s.number() }),
      result: s.number(),
      examples: [
        { description: 'adds to what stands', given: [{ ask: 'bump', args: { by: 2 } }], args: { by: 3 }, gives: { result: 5 } },
        { description: 'refuses to go down', args: { by: -1 }, gives: { error: { message: 'by is negative' } } },
      ],
    },
    stop: { in: 'counting', for: 'keeper', to: 'stopped', examples: [{ gives: { result: null } }] },
    read: {
      hints: { readOnly: true },
      result: s.number(),
      examples: [{ description: 'stopped at seven', given: [{ ask: 'bump', args: { by: 7 } }, { ask: 'stop' }], gives: { result: 7 } }],
    },
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

/** A class whose answers are the same twice and whose cells are not: randomness hidden where no ask shows it. */
export class Stamp extends Being.of({
  kind: 'org.example.stamp',
  cells: { nonce: 0 },
  asks: { stamp: { examples: [{ description: 'hides a nonce', gives: { result: null } }] } },
}) {
  stamp() {
    this.cells.nonce = Math.random();
  }
}

/** A class whose role holds only on what her cells hold after an ask: root keeps her once it claims her. */
export class Keep extends Being.of({
  kind: 'org.example.keep',
  cells: { keeper: '' },
  state: (me) => (me.cells.keeper === '' ? 'open' : 'kept'),
  roles: { keeper: (asker, me) => asker.id === me.cells.keeper },
  asks: {
    claim: { in: 'open', to: 'kept', examples: [{ gives: { result: null } }] },
    guard: { in: 'kept', for: 'keeper', result: s.string(), examples: [{ given: [{ ask: 'claim' }], gives: { result: 'kept' } }] },
  },
}) {
  claim() {
    this.cells.keeper = this.asker.id;
  }

  guard() {
    return 'kept';
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
