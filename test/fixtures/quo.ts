// Where Quo's verifier and vectors stand: in `quo/` beside the kit, Quo's
// own repository at the commit the kit's manifest pins, with the verifier
// and the vectors at its root. The check fetches it there first, once, and
// every test reads it offline.
import { existsSync } from 'node:fs';

const quo = new URL('../../../quo/', import.meta.url);
if (!existsSync(new URL('SPEC.md', quo)) || !existsSync(new URL('verifier/cli.js', quo))) throw new Error('Quo stands nowhere beside the kit: node quo.mjs fetches it at its pin');

/** The folders of Quo's verifier and of its vectors, each ending in a slash. */
export const verifier = new URL('verifier/', quo);
export const vectors = new URL('vectors/', quo);
