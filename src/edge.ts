// SPDX-License-Identifier: Apache-2.0
// `nervur` as a Workers bundle reads it: the main entry, with the edge
// ground added, so `Harbor.open({ given: { state, env } })` in a Durable
// Object keeps a harbor in its storage.
import { edgeGround } from './core/edge/index.ts';
import { addGround } from './core/harbor/index.ts';
import { DEFAULTS } from './index.ts';

export * from './index.ts';

addGround(edgeGround, DEFAULTS);
