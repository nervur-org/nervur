// SPDX-License-Identifier: Apache-2.0
// Classes from a folder the ground names. The folder's entry, `index.js`,
// `index.mjs` or `index.ts`, exports `steward`, and `public` and `beings`
// where it has them, as `ClassList` takes them. How code reaches the
// folder is not the library's: a copy, a checkout, a deploy.
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ClassList } from '../bodies/class-list.ts';
import type { Classes, ClassesSource } from '../foundation.ts';

const ENTRIES = ['index.js', 'index.mjs', 'index.ts'];

export const FolderClasses = Object.freeze({
  /** The folder's entry as a source a runner loads, or a refusal that says the folder has none. */
  async source(dir: string | URL): Promise<ClassesSource> {
    const folder = resolve(typeof dir === 'string' ? dir : fileURLToPath(dir));
    for (const name of ENTRIES) {
      const at = join(folder, name);
      if (await access(at).then(() => true, () => false)) return { modules: [pathToFileURL(at).href] };
    }
    throw new Error(`the folder ${folder} has no ${ENTRIES.join(', ')}`);
  },

  /** The folder's classes, loaded once here, or a refusal that says what the folder lacks. */
  async open(dir: string | URL): Promise<Classes> {
    return ClassList.load(await FolderClasses.source(dir));
  },
});
