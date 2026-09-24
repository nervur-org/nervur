// SPDX-License-Identifier: Apache-2.0
// Classes from a folder the ground names. The folder's entry, `index.js`,
// `index.mjs` or `index.ts`, exports `steward`, and `public` and `beings`
// where it has them, as `ClassList` takes them. How code reaches the
// folder is not the library's: a copy, a checkout, a deploy.
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ClassList } from '../bodies/class-list.ts';
import type { BeingClass, Classes } from '../foundation.ts';

const ENTRIES = ['index.js', 'index.mjs', 'index.ts'];

export const FolderClasses = Object.freeze({
  /** The folder's classes, loaded once, or a refusal that says what the folder lacks. */
  async open(dir: string | URL): Promise<Classes> {
    const folder = resolve(typeof dir === 'string' ? dir : fileURLToPath(dir));
    let entry: string | undefined;
    for (const name of ENTRIES) {
      const at = join(folder, name);
      if (await access(at).then(() => true, () => false)) {
        entry = at;
        break;
      }
    }
    if (entry === undefined) throw new Error(`the folder ${folder} has no ${ENTRIES.join(', ')}`);
    const module = (await import(pathToFileURL(entry).href)) as { steward?: BeingClass; public?: BeingClass; beings?: readonly BeingClass[] };
    if (module.steward === undefined) throw new Error(`${entry} exports no steward`);
    if (module.beings !== undefined && !Array.isArray(module.beings)) throw new Error(`${entry} exports beings that are not a list`);
    return new ClassList({ steward: module.steward, ...(module.public === undefined ? {} : { public: module.public }), ...(module.beings === undefined ? {} : { beings: module.beings }) });
  },
});
