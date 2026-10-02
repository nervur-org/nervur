// A class asked by each role the bench plays beside its own steward: an
// effect her steward asks, awaited asks her steward and a being introduced
// to her ask, and one that refuses. And a public being a stranger asks,
// which refuses too.
import { Being, s, type Args } from 'nervur/being';

export class Ledger extends Being.of({
  kind: 'org.example.ledger',
  cells: { lines: [] as string[] },
  asks: {
    note: { for: 'steward', args: s.object({ line: s.string() }), result: s.number() },
    count: { for: ['steward', 'being'], readOnly: true, result: s.number() },
    check: { for: ['steward', 'being'], idempotent: true, args: s.object({ line: s.string() }), result: s.boolean() },
  },
}) {
  note({ line }: Args<Ledger, 'note'>) {
    this.cells.lines = [...this.cells.lines, line];
    return this.cells.lines.length;
  }

  count() {
    return this.cells.lines.length;
  }

  check({ line }: Args<Ledger, 'check'>) {
    if (line === '') this.fail('the line is empty');
    return this.cells.lines.includes(line);
  }
}

export class Desk extends Being.of({
  kind: 'org.example.desk',
  asks: {
    greet: { for: 'stranger', idempotent: true, args: s.object({ name: s.string() }), result: s.string() },
    close: { for: 'steward' },
  },
}) {
  greet({ name }: Args<Desk, 'greet'>) {
    if (name === '') this.fail('a stranger names herself');
    return `welcome, ${name}`;
  }

  close() {}
}
