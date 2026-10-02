// SPDX-License-Identifier: Apache-2.0
// Classes from the ground's own origin. A module at a path under the
// origin exports `steward`, and `public` and `beings` where it has them, as
// `ClassList` takes them. A path that resolves off the origin is refused,
// as a folder of code on a NodeGround stays inside its folder. A house's
// runner loads the module in its own thread; where the classes load in
// place, a service worker, which may not `import()`, hands a loader that
// answers the same paths from modules it imported itself.
import { ClassList, type Load } from '../bodies/class-list.ts';
import type { Classes, ClassesSource } from '../foundation.ts';

export type { Load } from '../bodies/class-list.ts';

export const OriginClasses = Object.freeze({
  /** The module at `at`, resolved against `origin`, as a source a runner loads, or a refusal where it stands off the origin. */
  source(at: string, origin: string): ClassesSource {
    const base = new URL(origin.endsWith('/') ? origin : `${origin}/`);
    const url = new URL(at, base);
    if (url.origin !== base.origin || !url.href.startsWith(base.href)) throw new Error(`the code at ${at} stands off ${base.href}`);
    return { modules: [url.href] };
  },

  /** The classes of the module at `at`, resolved against `origin`, loaded once here. */
  async open(at: string, origin: string, load: Load = (href) => import(href)): Promise<Classes> {
    return ClassList.load(OriginClasses.source(at, origin), load);
  },
});
