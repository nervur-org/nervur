// classes/lobby.ts
import { Being, need, s } from 'nervur/being';

/** What the lobby asks of her steward. */
const Signup = need('signup', {
  enroll: {
    hints: { idempotent: true },
    args: s.object({ signer: s.bytes() }),
    result: s.object({ invitation: s.invitation() }),
  },
});

export class Lobby extends Being.of({
  kind: 'com.acme.lobby',
  description: 'The shop’s front door: a stranger signs up and receives an order of their own.',
  asks: {
    signup: { for: 'stranger', result: s.object({ invitation: s.invitation() }) },
  },
}) {
  signup() {
    return this.held('steward', Signup).enroll({ signer: this.asker.signer! });
  }
}
