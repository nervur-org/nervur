// SPDX-License-Identifier: Apache-2.0
// `nervur` as Node reads it: the main entry, with the Node ground added, so
// `Harbor.open()` keeps a harbor in a folder and serves its root line.
import { addGround } from './core/harbor/index.ts';
import { nodeGround } from './core/node/index.ts';
import { DEFAULTS } from './index.ts';

export * from './index.ts';

addGround(nodeGround, DEFAULTS);
