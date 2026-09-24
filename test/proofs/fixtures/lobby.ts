// A public being: a stranger signs up, and her steward enrols them.
import { Being, s } from 'nervur/being';

export class Lobby extends Being.of({
  kind: 'org.example.lobby',
  description: 'Where a stranger signs up.',
  cells: { visits: 0 },
  asks: {
    signup: { for: 'stranger', result: s.object({ invitation: s.invitation() }) },
    effect: { for: 'stranger', hints: { idempotent: false } },
    visit: { for: 'stranger', result: s.number() },
  },
}) {
  visit() {
    this.cells.visits += 1;
    return this.cells.visits;
  }

  async signup() {
    const answer = (await this.steward!.enroll({ signer: this.asker.signer } as never)) as { invitation: unknown };
    return { invitation: answer.invitation };
  }

  effect() {}
}
