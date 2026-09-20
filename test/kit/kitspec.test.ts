// SPDX-License-Identifier: Apache-2.0
// `KIT-SPEC.md` answers every question of Quo's, in its order, and each
// number it names is the number the code holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GONE, SPAN } from '../../src/core/quo/index.ts';
import { CEILING, DEFAULT, DEPTH } from '../../src/core/ward/index.ts';
import { join } from 'node:path';
import { holds } from '../claims.ts';
import { QUO } from '../where.mjs';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
const ours = await read('../../KIT-SPEC.md');
const quo = await readFile(join(QUO, 'KIT-SPEC.md'), 'utf8');
const questions = (text: string): string[] => [...text.matchAll(/\*\*Question (\d+)\. ([^*]+)\*\*/g)].map((m) => `${m[1]}. ${m[2]!.replace(/\s+/g, ' ')}`);
const answer = (n: number): string => ours.split(`**Question ${n}.`)[1]!.split('**Question ')[0]!.replace(/\s+/g, ' ');
const number = (n: number): string => n.toLocaleString('en-US');

test('[kitspec] every question of Quo is answered, in its order, in its words', () => {
  assert.deepEqual(questions(ours), questions(quo));
});

test(holds('proof.kitspec', 'kitspec: the numbers the answers name are the numbers the code holds'), () => {
  assert.match(answer(10), new RegExp(`last ${GONE} removed`));
  assert.match(answer(11), new RegExp(`span of ${SPAN} below`));
  assert.match(answer(21), new RegExp(`${number(DEFAULT)} ms .* never above ${number(CEILING)} ms`));
  assert.match(answer(27), new RegExp(`nested deeper than ${DEPTH}`));
});
