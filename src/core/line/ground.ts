// SPDX-License-Identifier: Apache-2.0
// The ground that fits wherever JavaScript runs, and the one the main
// entry adds: the pointer bodies, so the harbor lives as long as its
// process, code run by the engine's own import, or found in the bundle it
// is handed where the engine imports none. It listens nowhere and has no
// sockets, so the web carrier dials from it and nothing else carries. A
// ground whose bodies keep a harbor, a browser's or an edge's, is added by
// its own entry and tried before this one.
import type { GroundProbe } from '../harbor/index.ts';
import { BundleLoader, PointerTerrain, SourceLoader } from '../pointer/index.ts';

export const NEUTRAL = 'neutral';

export const neutralGround: GroundProbe = {
  name: NEUTRAL,
  fits: () => true,
  terrain: ({ bundle }, defaults) => new PointerTerrain({ loader: bundle ? new BundleLoader(bundle) : new SourceLoader(), defaults }),
};
