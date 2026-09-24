// Classes the house refuses when it first resolves them, one defect each,
// and two it accepts at the edge: one whose last state no ask leaves, and
// one whose view is exactly its bound.
import { Being, s, need } from 'nervur/being';

const Pay = need('payments', { charge: {} });

export class BadKind extends Being.of({ kind: 'Order', asks: { go: {} } }) {
  go() {}
}

// A view is text a screen holds: at most 64 KiB.
export class WideView extends Being.of({ kind: 'org.example.wide', view: 'x'.repeat(65_537), asks: { go: {} } }) {
  go() {}
}

// A need is held as its author wrote it: a field that is none, or a wait past the bound, refuses her.
const Misspelled = need('misspelled', { go: { wiat: 5 } as never, far: { wait: 400_000 } });

export class WrittenNeed extends Being.of({ kind: 'org.example.written', needs: { m: Misspelled }, asks: { go: {} } }) {
  go() {}
}

// Its bound is bytes, not characters: 21,846 euro signs are 65,538 bytes.
export class WideInBytes extends Being.of({ kind: 'org.example.wide.bytes', view: '€'.repeat(21_846), asks: { go: {} } }) {
  go() {}
}

// A view of exactly 64 KiB is held, a pair of surrogates taking four bytes.
export class FullView extends Being.of({ kind: 'org.example.wide.full', view: `${'😀'.repeat(16_383)}xxxx`, asks: { go: {} } }) {
  go() {}
}

export class Unreached extends Being.of({
  kind: 'org.example.unreached',
  cells: { state: 'a' },
  state: (me) => me.cells.state,
  asks: { go: { in: 'b', to: 'a' } },
}) {
  go() {}
}

export class NoSuchRole extends Being.of({ kind: 'org.example.role', asks: { go: { for: 'owner' } } }) {
  go() {}
}

export class UnusedRole extends Being.of({ kind: 'org.example.unused', roles: { owner: () => true }, asks: { go: {} } }) {
  go() {}
}

export class HouseRole extends Being.of({ kind: 'org.example.house-role', roles: { steward: () => true }, asks: { go: { for: 'steward' } } }) {
  go() {}
}

export class NoMethod extends Being.of({ kind: 'org.example.no-method', asks: { go: {}, stay: {} } }) {
  go() {}
}

export class NeedAndAsk extends Being.of({ kind: 'org.example.clash', needs: { pay: Pay }, asks: { pay: {} } }) {
  // @ts-expect-error the method and the need share a name, which the house refuses too
  pay() {}
}

export class NeedAndMethod extends Being.of({ kind: 'org.example.helper', needs: { pay: Pay }, asks: { go: {} } }) {
  go() {}
  // @ts-expect-error a helper named as a need
  pay() {}
}

export class AskAndBeing extends Being.of({ kind: 'org.example.member', asks: { cells: {} } }) {}

export class AskOfEveryObject extends Being.of({ kind: 'org.example.object', asks: { toString: {} } }) {
  override toString() {
    return '';
  }
}

export class Outside extends Being.of({ kind: 'org.example.outside', asks: { go: { args: { type: 'object', format: 'x' } } } }) {
  go() {}
}

export class ArgsNotObject extends Being.of({ kind: 'org.example.args', asks: { go: { args: s.string() } } }) {
  go() {}
}

export class Stateless extends Being.of({ kind: 'org.example.stateless', asks: { go: { to: 'done' } } }) {
  go() {}
}

export class ReadOnlyWrites extends Being.of({ kind: 'org.example.read', asks: { go: { hints: { readOnly: true, idempotent: false } } } }) {
  go() {}
}

export class NotJson extends Being.of({ kind: 'org.example.json', cells: { at: new Date(0) as never }, asks: { go: {} } }) {
  go() {}
}

export class Terminal extends Being.of({
  kind: 'org.example.terminal',
  cells: { state: 'open' },
  state: (me) => me.cells.state,
  asks: { close: { in: 'open', to: 'closed' } },
}) {
  close() {
    this.cells.state = 'closed';
  }
}
