// A steward that lends doors for a time, in each of the three ways a being makes one.
import { Being, s, type Args } from 'nervur/being';

export class Lender extends Being.of({
  kind: 'org.example.lender',
  cells: { pings: 0 },
  roles: { pilot: (asker) => asker.id === 'root' },
  asks: {
    lend: {
      for: 'pilot',
      args: s.object({ way: s.enum(['invite', 'handle', 'powers']), id: s.string(), expires: s.optional(s.number()) }),
      result: s.object({ handle: s.handle() }),
    },
    bear: { for: 'pilot', args: s.object({ kind: s.string(), id: s.string() }) },
    adopt: { for: 'pilot', args: s.object({ invitation: s.handle() }), result: s.string() },
    ping: { for: 'handle' },
  },
}) {
  lend({ way, id, expires }: Args<Lender, 'lend'>) {
    const lasting = expires === undefined ? {} : { expires };
    if (way === 'handle') return { handle: this.handle('ping', lasting) };
    if (way === 'powers') return { handle: this.powers!.invite({ id, occupant: 'owner', notes: { owner: true }, ...lasting }) };
    return { handle: this.invite(id, lasting) };
  }

  bear({ kind, id }: Args<Lender, 'bear'>) {
    this.powers!.bear({ kind, id });
  }

  adopt({ invitation }: Args<Lender, 'adopt'>) {
    return invitation;
  }

  ping() {
    this.cells.pings += 1;
  }
}
