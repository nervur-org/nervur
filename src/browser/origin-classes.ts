// SPDX-License-Identifier: Apache-2.0
// Classes from the ground's own origin. A module at a path under the
// origin exports `steward`, and `public` and `beings` where it has them, as
// `ClassList` takes them. A path that resolves off the origin is refused,
// as a folder of code on a NodeGround stays inside its folder. A service
// worker may not `import()`, so there the worker's own build hands a
// loader that answers the same paths from modules it imported itself.
import { ClassList } from '../bodies/class-list.ts';
import type { BeingClass, Classes } from '../foundation.ts';

/** What loads a module by its URL: the engine's `import()` where none is handed. */
export type Load = (href: string) => Promise<unknown>;

export const OriginClasses = Object.freeze({
  /** The classes of the module at `at`, resolved against `origin`, loaded once. */
  async open(at: string, origin: string, load: Load = (href) => import(href)): Promise<Classes> {
    const base = new URL(origin.endsWith('/') ? origin : `${origin}/`);
    const url = new URL(at, base);
    if (url.origin !== base.origin || !url.href.startsWith(base.href)) throw new Error(`the code at ${at} stands off ${base.href}`);
    const module = (await load(url.href)) as { steward?: BeingClass; public?: BeingClass; beings?: readonly BeingClass[] };
    if (module.steward === undefined) throw new Error(`${url.href} exports no steward`);
    if (module.beings !== undefined && !Array.isArray(module.beings)) throw new Error(`${url.href} exports beings that are not a list`);
    return new ClassList({ steward: module.steward, ...(module.public === undefined ? {} : { public: module.public }), ...(module.beings === undefined ? {} : { beings: module.beings }) });
  },
});
