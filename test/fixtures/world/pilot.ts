// A pilot: she holds the ground's `houses` faculty where the record grants
// it to her house, and adds, removes and lists houses through it.
import { Being, need, s, type Args } from 'nervur/being';

// Her need names the bodies she hands, at their minimum; the ground's offer checks the args.
export const Houses = need('houses', {
  add: {
    args: s.object({ name: s.string(), memory: s.object({ faculty: s.string() }), classes: s.object({ faculty: s.string(), set: s.string() }) }),
    result: s.object({ ward: s.string() }),
    hints: { idempotent: true },
  },
  remove: { args: s.object({ name: s.string() }), hints: { idempotent: true } },
});

export class Pilot extends Being.of({
  kind: 'org.example.pilot',
  needs: { houses: Houses },
  asks: {
    open: { hints: { idempotent: true }, args: s.object({ name: s.string(), set: s.string() }), result: s.string() },
    close: { hints: { idempotent: true }, args: s.object({ name: s.string() }) },
  },
}) {
  async open({ name, set }: Args<Pilot, 'open'>) {
    const { ward } = await this.houses.add({ name, memory: { faculty: 'fake' }, classes: { faculty: 'list', set } });
    return ward;
  }

  async close({ name }: Args<Pilot, 'close'>) {
    await this.houses.remove({ name });
  }
}

/** A class of another kind whose need `houses` covers too, in the same house as the pilot. */
export class Stowaway extends Being.of({
  kind: 'org.example.stowaway',
  needs: { houses: Houses },
  asks: {
    open: { hints: { idempotent: true }, args: s.object({ name: s.string(), set: s.string() }), result: s.string() },
  },
}) {
  async open({ name, set }: Args<Stowaway, 'open'>) {
    const { ward } = await this.houses.add({ name, memory: { faculty: 'fake' }, classes: { faculty: 'list', set } });
    return ward;
  }
}
