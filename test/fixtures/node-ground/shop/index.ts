// A house's folder of code: its steward, and a parrot who repeats through
// the ground's echo faculty.
import { Being, s, type Args } from 'nervur/being';
import { Echo } from '../echo.ts';

export { Steward as steward } from '../../world/steward.ts';

export class Parrot extends Being.of({
  kind: 'org.example.parrot',
  needs: { echo: Echo },
  asks: {
    repeat: { args: s.object({ text: s.string() }), result: s.string(), hints: { readOnly: true } },
  },
}) {
  repeat({ text }: Args<Parrot, 'repeat'>) {
    return this.echo.say({ text });
  }
}

export const beings = [Parrot];
