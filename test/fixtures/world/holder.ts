// A holder: she takes a far counter's invitation as her standing, reads it
// awaited, adds to it by effects, and keeps every reply in the order it came.
import { Being, s, need, type Args } from 'nervur/being';

/** A far counter, as she asks it through her standing. */
export const Tally = need('tally', {
  add: { args: s.object({ by: s.optional(s.number()) }) },
  total: { result: s.number(), readOnly: true },
});

export class Holder extends Being.of({
  kind: 'org.example.holder',
  cells: { standing: '', replies: [] as string[] },
  asks: {
    take: { args: s.object({ invitation: s.handle() }), idempotent: true },
    total: { idempotent: true, result: s.number() },
    bump: { args: s.object({ times: s.number() }) },
    added: { for: 'standing', args: s.reply(Tally.add) },
    replies: { readOnly: true, result: s.array(s.string()) },
    holding: { readOnly: true, result: s.array(s.string()) },
  },
}) {
  take({ invitation }: Args<Holder, 'take'>) {
    this.cells.standing = invitation;
  }

  async total() {
    const { result, error } = await this.held(this.cells.standing, Tally).total({});
    if (error) this.fail(error.message);
    return result;
  }

  bump({ times }: Args<Holder, 'bump'>) {
    for (let one = 0; one < times; one++) this.held(this.cells.standing, Tally).add({}, { reply: 'added' });
  }

  added(reply: Args<Holder, 'added'>) {
    this.cells.replies = [...this.cells.replies, 'error' in reply && reply.error !== undefined ? reply.error.message : 'added'];
  }

  replies() {
    return this.cells.replies;
  }

  // Her standings as she lists them, her steward's aside.
  holding() {
    return this.standings
      .list()
      .map(({ id }: { id: string }) => id)
      .filter((id: string) => id !== 'steward');
  }
}
