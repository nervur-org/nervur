// The Pi's registry, stood by the maker `module`: its relay, which an
// entry grants to the garage twin alone. The relay keeps each call id, so
// a pulse sent twice acts once; the run reads its count from here.
import type { Registry } from 'nervur';
import { Pulses, Relay } from '../../../../test/fixtures/world/outpost.ts';

export const pulses = new Pulses();

export const faculties: Registry['faculties'] = {
  relay: () => ({ blueprint: Relay, object: pulses }),
};
