// A public being: a stranger signs up, and her steward enrols them.
import { Being, s } from 'nervur/being';

export class Lobby extends Being.of({
  kind: 'org.example.lobby',
  description: 'Where a stranger signs up.',
  cells: { visits: 0 },
  asks: {
    signup: { for: 'stranger', idempotent: true, result: s.object({ invitation: s.invitation() }) },
    effect: { for: 'stranger', replayable: true },
    visit: { for: 'stranger', replayable: true, result: s.number() },
  },
}) {
  visit() {
    this.cells.visits += 1;
    return this.cells.visits;
  }

  async signup() {
    const answered = await this.steward!.enroll({ signer: this.asker.signer } as never);
    if (answered === undefined || answered.error) this.fail(answered?.error?.message ?? 'enroll was no awaited call');
    return { invitation: (answered.result as { invitation: unknown }).invitation };
  }

  effect() {}
}
