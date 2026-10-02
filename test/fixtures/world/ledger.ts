// A tally and a sender, across a network. The sender adds to the far tally
// by an effect, which acts at most once, and keeps each reply she hears.
import { Being, need, s, type Args } from 'nervur/being';

/** What the sender calls on the tally: `add` is an effect, `total` awaited. */
export const Tallied = need('tally', {
  add: { args: s.object({ by: s.number() }), result: s.number() },
  total: { result: s.number(), readOnly: true },
});

export class Tally extends Being.of({
  kind: 'org.example.tally',
  cells: { total: 0, adds: 0 },
  asks: {
    add: { args: s.object({ by: s.number() }), result: s.number() },
    total: { result: s.number(), readOnly: true },
    adds: { result: s.number(), readOnly: true },
  },
}) {
  add({ by }: Args<Tally, 'add'>) {
    this.cells.total += by;
    this.cells.adds += 1;
    return this.cells.total;
  }

  total() {
    return this.cells.total;
  }

  adds() {
    return this.cells.adds;
  }
}

export class Sender extends Being.of({
  kind: 'org.example.sender',
  cells: { tally: '', heard: [] as number[], failed: [] as string[] },
  asks: {
    accept: { args: s.object({ invitation: s.handle() }), idempotent: true },
    send: { args: s.object({ by: s.number() }) },
    sent: { for: 'standing', args: s.reply(Tallied.add) },
    read: { readOnly: true, result: s.number() },
    log: { readOnly: true, result: s.object({ heard: s.array(s.number()), failed: s.array(s.string()) }) },
  },
}) {
  accept({ invitation }: Args<Sender, 'accept'>) {
    this.cells.tally = invitation;
  }

  send({ by }: Args<Sender, 'send'>) {
    this.held(this.cells.tally, Tallied).add({ by }, { reply: 'sent' });
  }

  sent({ result, error }: Args<Sender, 'sent'>) {
    if (error === undefined) this.cells.heard = [...this.cells.heard, result];
    else this.cells.failed = [...this.cells.failed, error.message];
  }

  async read() {
    const { result, error } = await this.held(this.cells.tally, Tallied).total({});
    if (error) this.fail(error.message);
    return result;
  }

  log() {
    return { heard: this.cells.heard, failed: this.cells.failed };
  }
}
