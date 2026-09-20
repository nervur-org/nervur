// SPDX-License-Identifier: Apache-2.0
// The arithmetic records of `quo/vectors/arithmetic.json`, which the crypto
// suite reproduces. They are read from the `quo/` the walk up finds, so one
// path holds in this tree and in the library's own repository.
//
// This module is alone so that it can be replaced. Every engine runs the
// same records, and a bundle for a browser or an edge has no file system,
// so the terrain's bundler swaps this file for the records themselves. The
// reading stays here, in the one place that is allowed to have one.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUO } from './where.mjs';

export type Record = { name: string; refuses?: boolean } & { [field: string]: string | boolean | undefined };

export const records: Record[] = (JSON.parse(readFileSync(join(QUO, 'vectors/arithmetic.json'), 'utf8')) as { vectors: Record[] }).vectors;
