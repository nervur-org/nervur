// Alice: she takes Bob's paper, which makes it her standing, and greets
// him through it.
import { Being, s, type Args } from 'nervur/being';
import { Hosted } from './host.ts';

export class Guest extends Being.of({
  kind: 'org.example.guest',
  cells: { standing: '' },
  asks: {
    // Taking a paper twice gives the standing it made, so it is safe to repeat.
    accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    greetHost: { hints: { readOnly: true, idempotent: true }, result: s.string() },
    standingsList: { hints: { readOnly: true, idempotent: true }, result: s.array(s.string()) },
  },
}) {
  accept({ invitation }: Args<Guest, 'accept'>) {
    this.cells.standing = invitation;
  }

  async greetHost() {
    return this.held(this.cells.standing, Hosted).greet({});
  }

  standingsList() {
    return this.standings
      .list()
      .map(({ id }: { id: string }) => id)
      .filter((id: string) => id !== 'steward');
  }
}
