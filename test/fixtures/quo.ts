// Where `quo/` stands: the nearest folder above the package holding
// `quo/SPEC.md`. Here that is the repository root; in the public
// repository's gate it is the folder `nervur` and `quo` are checked out in.
import { existsSync } from 'node:fs';

const find = (): URL => {
  for (let at = new URL('../../', import.meta.url); at.pathname !== '/'; at = new URL('../', at)) {
    const quo = new URL('quo/', at);
    if (existsSync(new URL('SPEC.md', quo))) return quo;
  }
  throw new Error('no folder above the package holds quo/SPEC.md');
};

/** The `quo/` folder, ending in a slash. */
export const quo = find();
