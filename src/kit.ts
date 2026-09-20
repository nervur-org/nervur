// SPDX-License-Identifier: Apache-2.0
// The kit a stranger writes a world with, and what a module's `'nervur'`
// reads: the core of `core.ts` and the defaults joined. It names no
// platform, so it runs wherever JavaScript runs. The main entry binds it as
// the kit a loader links a module against, so every ground and the command
// bind it.
import { DefaultDock, DefaultWard, GroundMemory, TcpFaculty, WebFaculty } from './defaults/index.ts';
import type { Defaults } from './core/harbor/index.ts';

export * from './core.ts';

// The defaults: the beings and faculties a harbor runs where its owner
// writes none, and the list every ground runs them from.
export { DefaultDock, DefaultWard, GroundMemory, TcpFaculty, WebFaculty } from './defaults/index.ts';
export const DEFAULTS: Defaults = { dock: DefaultDock, ward: DefaultWard, classes: [GroundMemory, TcpFaculty, WebFaculty] };
