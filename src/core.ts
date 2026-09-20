// SPDX-License-Identifier: Apache-2.0
// The core as a stranger's code reads it: every export of the kit that is
// no default. It names no platform, so it runs wherever JavaScript runs.
// `kit.ts` joins it with the defaults; the core's own suites bind it with
// classes written for them, so a module they load reads the core alone.

// Beings, faculties, and what they are told.
export { Being, canonical, digest, Faculty, isSilence, isWord, OWNER, silence, told, WARD, word } from './core/being/index.ts';
export type { Answer, Ask, Asker, AskSpec, BeingClass, BeingLike, Blueprint, Invitation, Json, JsonObject, Occupants, Reply, Schema, Silence, Stance, Standing, Standings, Wanted, Word, WordName } from './core/being/index.ts';
export { readInvitation } from './core/quo/index.ts';

// What a terrain gives a harbor.
export { Carrier, Clock, Custody, Entropy, Loader, Memory, type Bundled, type Module, type Rows } from './core/contract/index.ts';

// Wards and the ward.
export { CEILING, DEFAULT, DEPTH, ownerAsk, pilots, Ward, type Steward, type WardStance } from './core/ward/index.ts';

// The onion, and the one line its root's asks cross from any front.
export {
  BOX,
  CarrierFaculty,
  Catalogue,
  copyPackage,
  Dock,
  Harbor,
  addGround,
  groundOf,
  grounds,
  readRootRequest,
  Registry,
  REGISTRY,
  RegistryFaculty,
  MemoryFaculty,
  MEMORY,
  Terrain,
  UNDIALED,
  type Defaults,
  type Dialed,
  type Failures,
  type Ground,
  type GroundProbe,
  type Probing,
  type RootRequest,
  type Sockets,
  type TcpListening,
  type WebListen,
  type WebListener,
  type WebServe,
} from './core/harbor/index.ts';

// The pointer dock: a whole world in one process, and the loaders of code.
export { BundleLoader, CryptoEntropy, HeldCustody, SourceLoader, NoCarrier, PointerCarrier, PointerTerrain, SystemClock, VolatileMemory, World, type PointerParts, type WorldParts } from './core/pointer/index.ts';
export { answerPost } from './core/line/answer.ts';
export { NEUTRAL } from './core/line/ground.ts';
export { WebDialer } from './core/line/index.ts';
