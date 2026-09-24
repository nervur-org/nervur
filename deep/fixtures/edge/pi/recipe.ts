// The Pi's ground: its relay, granted to the garage twin alone. The relay
// keeps each call id, so a pulse sent twice acts once; the run reads its
// count from here.
import type { Faculty } from 'nervur';
import { Pulses, Relay } from '../../../../test/fixtures/world/outpost.ts';

export const pulses = new Pulses();

export const faculties = (): Record<string, Faculty> => ({
  relay: { blueprint: Relay, object: pulses, kinds: ['org.example.garage-twin'] },
});
