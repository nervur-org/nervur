// SPDX-License-Identifier: Apache-2.0
// `nervur`: what a ground's author imports on any engine. The house, the
// blueprints of its foundation and the ground's unlock, and the bodies
// that fill them anywhere.
import { NobleCrypto } from './bodies/noble-crypto.ts';
import { StrictTools } from './bodies/strict-tools.ts';
import { WebClock } from './bodies/web-clock.ts';
import type { Carry, Classes, Clock, Crypto, Keys, Memory, Tools } from './foundation.ts';
import { openHouse, type Offer, type Opened } from './house/house.ts';

export { Carry, Classes, Clock, Crypto, Memory, Rung, Tools, type ClassesSource, type Contract, type Keys, type Sent } from './foundation.ts';
export { Faculty, OK, type Call, type FacultyClass, type FacultyExample, type ForHouse, type Made, type Registry, type Status, type Takes } from './faculty.ts';
export { engineStart, type Runner, type Start, type Thread } from './ground/runner.ts';
export { JoinedCarry } from './bodies/joined-carry.ts';
export { WebCarry, type Handler } from './bodies/web-carry.ts';
export { vouchesOf } from './bodies/vouch.ts';
export type { FacultyContext, Offer, Opened, OpenedContext } from './house/house.ts';
export { Ground, Hand, Installer, Unlock, type FacultyEntry, type Hooked } from './ground/ground.ts';
export { ClassList } from './bodies/class-list.ts';
export { dockSteward } from './ground/dock.ts';
export { NobleCrypto } from './bodies/noble-crypto.ts';
export { SeedKeys } from './bodies/seed-keys.ts';
export { StrictTools } from './bodies/strict-tools.ts';
export { WebClock } from './bodies/web-clock.ts';

/** The house: opened on its foundation and its offers, and the ground's bound on every ask. */
export const House = Object.freeze({
  /**
   * `clock`, `crypto` and `tools` take the library's defaults where the
   * ground hands none. `wait` bounds every ask here, where the ground can
   * hold less than an entry asks.
   */
  open(
    foundation: { keys: Keys; memory: Memory; classes: Classes; carry: Carry; clock?: Clock; crypto?: Crypto; tools?: Tools },
    offers: readonly Offer[] = [],
    options: { readonly wait?: number } = {},
  ): Promise<Opened> {
    return openHouse({ ...foundation, clock: foundation.clock ?? new WebClock(), crypto: foundation.crypto ?? new NobleCrypto(), tools: foundation.tools ?? new StrictTools() }, offers, options);
  },
});
