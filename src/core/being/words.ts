// SPDX-License-Identifier: Apache-2.0
// What a being is told when no object came back. Silence is one symbol.
// A word is one frozen object per name, so a being never makes one by
// accident, and two copies of the package in one bundle still agree.
//
//   removed, unannounced, repeated   a far door's words, as Quo says them
//   unreached                        nothing came back: asking again is safe
//   late                             the allowance ran out
//   dropped                          the standing was removed while asking
//   invitation                       what was handed is no invitation
import type { Word as DoorWord } from '../quo/index.ts';

export const silence: unique symbol = Symbol.for('nervur.silence');
export type Silence = typeof silence;
export const isSilence = (x: unknown): x is Silence => x === silence;

export type WordName = DoorWord | 'unreached' | 'late' | 'dropped' | 'invitation';
const KEY: unique symbol = Symbol.for('nervur.word');
export type Word<W extends WordName = WordName> = { readonly [KEY]: W };

const made = new Map<WordName, Word>();
export const word = <W extends WordName>(name: W): Word<W> => {
  let w = made.get(name);
  if (!w) made.set(name, (w = Object.freeze({ [KEY]: name })));
  return w as Word<W>;
};
export const isWord = (x: unknown): x is Word => typeof x === 'object' && x !== null && typeof (x as Record<symbol, unknown>)[KEY] === 'string';

// A word by its name, and anything else as it is, so one comparison says
// which answer came back.
export const told = (x: unknown): unknown => (isWord(x) ? x[KEY] : x);
