// A faculty a being rings when something she waited for has landed, so a
// test awaits the ring and never a clock. Ringing is an effect: it leaves
// only once her ask's cells have landed.
import type { Offer } from 'nervur';
import { need } from 'nervur/being';

export const BellBlueprint = need('bell', {
  ring: {},
});

export class Bell {
  #ring: () => void = () => undefined;
  /** Settles at the next ring. */
  rung = new Promise<void>((resolve) => (this.#ring = resolve));

  async ring() {
    this.#ring();
    return { result: null };
  }
}

export const bellOffer = (bell: Bell): Offer => ({ blueprint: BellBlueprint, object: bell });
