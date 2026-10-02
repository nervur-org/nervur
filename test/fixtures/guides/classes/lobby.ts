// classes/lobby.ts
import { Being, need, s } from 'nervur/being';

/** What the lobby asks of her steward. */
const Signup = need('signup', {
  enroll: {
    idempotent: true,
    args: s.object({ signer: s.bytes() }),
    result: s.object({ invitation: s.invitation() }),
  },
});

export class Lobby extends Being.of({
  kind: 'com.acme.lobby',
  description: 'The shop’s front door: a stranger signs up and receives an order of their own.',
  asks: {
    signup: { for: 'stranger', idempotent: true, result: s.object({ invitation: s.invitation() }) },
  },
}) {
  async signup() {
    return this.must(await this.held('steward', Signup).enroll({ signer: this.asker.signer! }));
  }
}
