// SPDX-License-Identifier: Apache-2.0
// `nervur` as a browser bundle reads it: the main entry, with the browser
// ground added, so `Harbor.open()` keeps a harbor in IndexedDB.
import { browserGround } from './core/browser/index.ts';
import { addGround } from './core/harbor/index.ts';
import { DEFAULTS } from './index.ts';

export * from './index.ts';

addGround(browserGround, DEFAULTS);
