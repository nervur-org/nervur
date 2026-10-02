// A house's code that carries an object with a need's method beside its
// classes: what the code exports is never an offer, so the need stays
// uncovered.
import { Gauge } from './gauge.ts';
import { Steward } from './steward.ts';

export const steward = Steward;
export const beings = [Gauge];
export const latch = { wait: () => ({ result: null }) };
