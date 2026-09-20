// SPDX-License-Identifier: Apache-2.0
// `nervur`: what a stranger writes a world with, the kit of `kit.ts`. It
// imports no platform, so it runs wherever JavaScript runs. A disk is
// `nervur/folder`. Node reads `node.ts` under this name instead, which
// adds the Node ground. It binds the kit, so wherever a ground stands, a
// module's `'nervur'` is this copy's.
import { bindKit } from './core/contract/index.ts';
import { addGround } from './core/harbor/index.ts';
import { neutralGround } from './core/line/index.ts';
import * as kit from './kit.ts';
import { DEFAULTS } from './kit.ts';

export * from './kit.ts';

bindKit(kit);

// The ground that fits everywhere, tried after any a platform entry adds.
addGround(neutralGround, DEFAULTS);
