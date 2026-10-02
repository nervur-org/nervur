// A house's folder of code: its steward, and a parrot who repeats through
// the ground's echo faculty.
import { Being, s, type Args } from 'nervur/being';
import { Echo } from '../echo.ts';

export { Steward as steward } from '../../world/steward.ts';

export class Parrot extends Being.of({
  kind: 'org.example.parrot',
  needs: { echo: Echo },
  asks: {
    repeat: { args: s.object({ text: s.string() }), result: s.string(), readOnly: true },
  },
}) {
  async repeat({ text }: Args<Parrot, 'repeat'>) {
    const { result, error } = await this.echo.say({ text });
    if (error) this.fail(error.message);
    return result;
  }
}

export const beings = [Parrot];
