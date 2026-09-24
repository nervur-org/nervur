// The steward of the garage's houses, piloted by their owner through the
// hand: she bears a being, and mints an occupant of one as a paper.
import { Being, s, type Args } from 'nervur/being';

export class Steward extends Being.of({
  kind: 'org.example.garage-steward',
  asks: {
    bear: { for: 'root', args: s.object({ kind: s.string(), id: s.string() }) },
    offerFor: { for: 'root', args: s.object({ being: s.string(), occupant: s.string() }), result: s.object({ handle: s.handle() }) },
  },
}) {
  bear({ kind, id }: Args<Steward, 'bear'>) {
    this.powers!.bear({ kind, id });
  }

  offerFor({ being, occupant }: Args<Steward, 'offerFor'>) {
    return { handle: this.powers!.invite({ id: being, occupant }) };
  }
}
