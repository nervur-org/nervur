// SPDX-License-Identifier: Apache-2.0
// The ground probe: `Harbor.open()` with no terrain asks each ground an
// entry knows whether it fits here, the one added last first, and opens on
// the terrain the first that fits makes, with the defaults the entry
// handed beside it. The main entry adds a ground that fits everywhere; an
// entry that names a platform adds its own.
import type { Bundled } from '../contract/index.ts';
import type { Defaults, Terrain } from './terrain.ts';

// What a probed harbor is told: where it keeps itself, as its ground reads
// a place, what the engine handed the code, such as an edge's object state
// and environment, and the bundle of modules a ground that evaluates no
// code it is handed runs from.
export type Probing = { readonly where?: string; readonly given?: unknown; readonly bundle?: readonly Bundled[] };

export type GroundProbe = {
  readonly name: string;
  fits(probing: Probing): boolean;
  terrain(probing: Probing, defaults: Defaults): Terrain;
};

// A ground an entry knows, with the defaults it runs there.
export type KnownGround = { readonly probe: GroundProbe; readonly defaults: Defaults };

const known: KnownGround[] = [];

// A ground this process can stand on, known once by its name.
export const addGround = (probe: GroundProbe, defaults: Defaults): void => {
  if (!known.some((k) => k.probe.name === probe.name)) known.push({ probe, defaults });
};

// The grounds known, in the order they are tried.
export const grounds = (): string[] => known.map((k) => k.probe.name).reverse();

// The terrain of the first ground that fits, and its name.
export const probeGround = (probing: Probing, among: readonly KnownGround[] = known): { ground: string; terrain: Terrain } => {
  for (const { probe, defaults } of [...among].reverse()) if (probe.fits(probing)) return { ground: probe.name, terrain: probe.terrain(probing, defaults) };
  throw new Error('no ground fits here');
};
