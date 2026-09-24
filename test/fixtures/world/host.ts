// Bob: he greets whoever asks him through an occupant his steward minted.
import { Being, s, need, type Args } from 'nervur/being';

/** What Alice asks Bob through her standing. */
export const Hosted = need('host', {
  greet: { result: s.string(), hints: { readOnly: true, idempotent: true } },
});

export class Host extends Being.of({
  kind: 'org.example.host',
  cells: { doors: 0 },
  asks: {
    greet: { hints: { readOnly: true, idempotent: true }, result: s.string() },
    // A new door on him, for whoever asks.
    door: { result: s.object({ handle: s.handle() }) },
    // He accepts a paper as Alice does, so a test can hand him his own.
    accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    occupantsList: { hints: { readOnly: true, idempotent: true }, result: s.array(s.string()) },
    dismiss: { args: s.object({ id: s.string() }) },
    standingsList: { hints: { readOnly: true, idempotent: true }, result: s.array(s.string()) },
  },
}) {
  greet() {
    return `${this.id} greets ${this.asker.id}`;
  }

  accept() {
    return undefined;
  }

  door() {
    this.cells.doors += 1;
    return { handle: this.invite(`door-${this.cells.doors}`) };
  }

  dismiss({ id }: Args<Host, 'dismiss'>) {
    this.occupants.dismiss(id);
  }

  occupantsList() {
    return this.occupants.list().map(({ id }: { id: string }) => id);
  }

  standingsList() {
    return this.standings
      .list()
      .map(({ id }: { id: string }) => id)
      .filter((id: string) => id !== 'steward');
  }
}
