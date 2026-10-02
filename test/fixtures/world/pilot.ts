// A pilot: she takes the invitation the ground's owner minted on the
// dock's steward, which makes it her standing there, and asks through it
// whatever the dock shows her.
import { Being, DockPilot, s, type Args, type Json } from 'nervur/being';

/** Any JSON value: a schema with no keyword. */
const ANY = Object.freeze({});

export class Pilot extends Being.of({
  kind: 'org.example.pilot',
  cells: { dock: '' },
  asks: {
    // Taking an invitation twice gives the standing it made, so it is safe to repeat.
    accept: { args: s.object({ invitation: s.handle() }), idempotent: true },
    pilot: { idempotent: true, args: s.object({ method: s.string(), args: s.optional(ANY) }), result: ANY },
    houses: { readOnly: true, result: ANY },
  },
}) {
  // The dock's houses, through the standing matched to the need every pilot holds.
  async houses() {
    const { result, error } = await this.held(this.cells.dock, DockPilot).housesList({});
    if (error) this.fail(error.message);
    return result as Json;
  }

  accept({ invitation }: Args<Pilot, 'accept'>) {
    this.cells.dock = invitation;
  }

  // What the dock shows her, then the ask she names from it.
  async pilot({ method, args }: Args<Pilot, 'pilot'>) {
    const dock = this.held(this.cells.dock);
    await dock.describe();
    const answered = await dock.ask(method, args ?? {});
    if (answered?.error) this.fail(answered.error.message);
    return (answered?.result ?? null) as Json;
  }
}
