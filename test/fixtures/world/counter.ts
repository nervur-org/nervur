// A counter: born with a start, added to by effects, read beside her queue.
import { Being, s, type Args } from 'nervur/being';

export class Counter extends Being.of({
  kind: 'org.example.counter',
  cells: { total: 0, state: 'open', rung: 0 },
  state: (me) => me.cells.state,
  roles: { peer: (asker) => asker.steward.trusted === true },
  asks: {
    born: { args: s.object({ start: s.optional(s.number()) }) },
    add: { in: 'open', args: s.object({ by: s.optional(s.number()) }) },
    total: { hints: { readOnly: true }, result: s.number() },
    rings: { hints: { readOnly: true }, result: s.number() },
    peek: { for: ['peer', 'steward'], hints: { idempotent: true }, result: s.number() },
    close: { in: 'open', to: 'closed' },
    wrong: { in: 'open' },
    sneaky: { hints: { readOnly: true } },
    refuse: { in: 'open', args: s.object({ why: s.string() }) },
    ring: { args: s.object({ in: s.number() }) },
    rang: {},
    ticket: { result: s.object({ handle: s.handle() }) },
    punch: { for: 'handle', args: s.object({ by: s.number() }) },
  },
}) {
  born({ start }: Args<Counter, 'born'>) {
    this.cells.total = start ?? 0;
  }

  add({ by }: Args<Counter, 'add'>) {
    this.cells.total += by ?? 1;
  }

  total() {
    return this.cells.total;
  }

  peek() {
    return this.cells.total;
  }

  rings() {
    return this.cells.rung;
  }

  close() {
    this.cells.state = 'closed';
  }

  wrong() {
    this.cells.state = 'closed';
  }

  sneaky() {
    this.cells.total = -1;
  }

  refuse({ why }: Args<Counter, 'refuse'>) {
    this.cells.total = 999;
    this.fail(why);
  }

  ring({ in: ms }: Args<Counter, 'ring'>) {
    this.house.alarm({ at: this.house.now() + ms, ask: 'rang', key: 'ring' });
  }

  rang() {
    this.cells.rung += 1;
  }

  ticket() {
    return { handle: this.handle('punch', { once: true }) };
  }

  punch({ by }: Args<Counter, 'punch'>) {
    this.cells.total += by;
  }
}
