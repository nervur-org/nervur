// A knot: one being who walks every rule of the graph. She invites an
// occupant, takes an invitation into a standing, asks through a standing,
// and cuts her own side of either, by drop or by dismiss.
import { Being, need, s, type Args } from 'nervur/being';

/** What one knot asks of another. */
export const Tug = need('tug', { tug: { idempotent: true, result: s.string() } });

export class Knot extends Being.of({
  kind: 'org.example.knot',
  cells: { tugged: 0 },
  asks: {
    mint: { args: s.object({ occupant: s.string() }), result: s.object({ handle: s.handle() }) },
    take: { idempotent: true, args: s.object({ invitation: s.handle() }), result: s.string() },
    tug: { idempotent: true, result: s.string() },
    pull: { idempotent: true, args: s.object({ standing: s.string() }), result: s.string() },
    drop: { args: s.object({ standing: s.string() }) },
    dismiss: { args: s.object({ occupant: s.string() }) },
    guests: { readOnly: true, result: s.array(s.string()) },
    holds: { readOnly: true, result: s.array(s.string()) },
    // The standings her steward's notes mark trusted.
    trusted: { readOnly: true, result: s.array(s.string()) },
  },
}) {
  mint({ occupant }: Args<Knot, 'mint'>) {
    return { handle: this.invite(occupant) };
  }

  take({ invitation }: Args<Knot, 'take'>) {
    return invitation;
  }

  // Answers who tugged her, as she sees them.
  tug() {
    this.cells.tugged += 1;
    return this.asker.id;
  }

  // Tugs through one standing, and answers what came back or why it failed.
  async pull({ standing }: Args<Knot, 'pull'>) {
    const { result, error } = await this.held(standing, Tug).tug({});
    return error ? `failed: ${error.message}` : result;
  }

  drop({ standing }: Args<Knot, 'drop'>) {
    this.standings.drop(standing);
  }

  dismiss({ occupant }: Args<Knot, 'dismiss'>) {
    this.occupants.dismiss(occupant);
  }

  guests() {
    return this.occupants.list().map(({ id }) => id);
  }

  trusted() {
    return this.standings
      .list()
      .filter(({ steward }) => steward.trusted === true)
      .map(({ id }) => id);
  }

  holds() {
    return this.standings.list().map(({ id }) => id);
  }
}
