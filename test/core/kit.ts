// SPDX-License-Identifier: Apache-2.0
// The kit the core's suites bind: the core, with the classes written for
// them, so a module a suite loads reads its `'nervur'` from the core alone
// and extends a dock or a ward no default wrote. A suite that loads a
// module imports this before it opens a harbor.
import * as core from '../../src/core.ts';
import { bindKit } from '../../src/core/contract/index.ts';
import * as classes from './classes.ts';

bindKit({ ...core, ...classes });

export * from '../../src/core.ts';
export * from './classes.ts';
