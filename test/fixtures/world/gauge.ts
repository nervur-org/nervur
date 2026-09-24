// A gauge: a count bumped by one ask and read by others, one read held on
// a latch the test lets go, her own notes on her relations, and a handle
// to her punch that other gauges take.
import { Being, s, need, type Args } from 'nervur/being';

/** A faculty that answers once the test lets it. */
export const Latch = need('latch', { wait: { hints: { readOnly: true } } });

/** A relation as a test reads it: her own `mine`, and her steward's `trusted`. */
const Relation = s.object({ id: s.string(), mine: s.optional(s.boolean()), trusted: s.optional(s.boolean()) });

const read = ({ id, notes, steward }: { id: string; notes: Readonly<Record<string, unknown>>; steward: Readonly<Record<string, unknown>> }) => ({
  id,
  ...(typeof notes.mine === 'boolean' ? { mine: notes.mine } : {}),
  ...(typeof steward.trusted === 'boolean' ? { trusted: steward.trusted } : {}),
});

export class Gauge extends Being.of({
  kind: 'org.example.gauge',
  needs: { latch: Latch },
  cells: { n: 0 },
  asks: {
    bump: {},
    get: { hints: { readOnly: true }, result: s.number() },
    // Reads her count, then holds on the latch before it answers.
    hold: { hints: { readOnly: true }, result: s.number() },
    ticket: { result: s.object({ handle: s.handle() }) },
    punch: { for: 'handle' },
    take: { hints: { idempotent: true }, args: s.object({ invitation: s.handle() }), result: s.string() },
    // An invitation carried unopened, and handed back as it came.
    carry: { hints: { idempotent: true }, args: s.object({ invitation: s.invitation() }), result: s.object({ invitation: s.invitation() }) },
    noteStanding: { args: s.object({ on: s.string(), mine: s.boolean() }) },
    noteOccupant: { args: s.object({ on: s.string(), mine: s.boolean() }) },
    standingNotes: { hints: { readOnly: true }, result: s.array(Relation) },
    occupantNotes: { hints: { readOnly: true }, result: s.array(Relation) },
  },
}) {
  bump() {
    this.cells.n += 1;
  }

  get() {
    return this.cells.n;
  }

  async hold() {
    const n = this.cells.n;
    await this.latch.wait({});
    return n;
  }

  ticket() {
    return { handle: this.handle('punch') };
  }

  punch() {
    this.cells.n += 1;
  }

  take({ invitation }: Args<Gauge, 'take'>) {
    return invitation;
  }

  carry({ invitation }: Args<Gauge, 'carry'>) {
    return { invitation };
  }

  noteStanding({ on, mine }: Args<Gauge, 'noteStanding'>) {
    this.standings.note(on, { mine });
  }

  noteOccupant({ on, mine }: Args<Gauge, 'noteOccupant'>) {
    this.occupants.note(on, { mine });
  }

  standingNotes() {
    return this.standings.list().map(read);
  }

  occupantNotes() {
    return this.occupants.list().map(read);
  }
}

/** The latch: each wait is let go by the test, and says when it began. */
export const latch = () => {
  const began: (() => void)[] = [];
  const held: (() => void)[] = [];
  return {
    object: {
      wait: () =>
        new Promise<{ result: null }>((answer) => {
          held.push(() => answer({ result: null }));
          began.shift()?.();
        }),
    },
    /** Resolves once the next wait has begun. */
    begun: () => new Promise<void>((begin) => began.push(begin)),
    /** Lets every wait held so far answer. */
    release: () => {
      for (const one of held.splice(0)) one();
    },
  };
};
