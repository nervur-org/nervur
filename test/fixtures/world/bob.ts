// Bob with a mailbox. He holds a standing on Alice, and an email that
// carries someone else's invitation reaches his inbox. He hands the paper
// to Alice unopened, and she takes it.
import { Being, need, s, type Args } from 'nervur/being';
import { MailBlueprint } from './mailbox.ts';

/** What Bob asks Alice: to take a paper, which is safe to repeat. */
const Taker = need('taker', {
  accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
});

export class Bob extends Being.of({
  kind: 'org.example.bob',
  needs: { mail: MailBlueprint },
  cells: { alice: '' },
  asks: {
    born: {},
    accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    received: { for: 'handle', args: s.object({ invitation: s.invitation() }) },
    standingsList: { hints: { readOnly: true, idempotent: true }, result: s.array(s.string()) },
  },
}) {
  standingsList() {
    return this.standings
      .list()
      .map(({ id }: { id: string }) => id)
      .filter((id: string) => id !== 'steward');
  }

  async born() {
    await this.mail.watch({ inbox: this.handle('received') });
  }

  accept({ invitation }: Args<Bob, 'accept'>) {
    this.cells.alice = invitation;
  }

  // The paper stays paper in his hands, and Alice is the one who takes it.
  async received({ invitation }: Args<Bob, 'received'>) {
    await this.held(this.cells.alice, Taker).accept({ invitation });
  }
}
