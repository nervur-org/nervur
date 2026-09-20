// SPDX-License-Identifier: Apache-2.0
// The reply text: `{ object, seen }`, `{ silence: true }` or `{ quo: word }`.
// `object` is carried as the text it was written in.
import { readObject } from '../crypto/index.ts';

export const WORDS = ['removed', 'unannounced', 'repeated'] as const;
export type Word = (typeof WORDS)[number];

export type Reply = { readonly object: string; readonly seen: string | null } | { readonly silence: true } | { readonly quo: Word };

export const SILENCE = '{"silence":true}';

export const writeReply = (reply: Reply): string => {
  if ('silence' in reply) return SILENCE;
  if ('quo' in reply) return `{"quo":"${reply.quo}"}`;
  return `{"object":${reply.object},"seen":${JSON.stringify(reply.seen)}}`;
};

const exactly = (fields: ReadonlyMap<string, string>, ...keys: string[]): boolean => fields.size === keys.length && keys.every((k) => fields.has(k));

// A reply text of one of the three shapes, or null for anything else, which
// the reader takes as silence.
export const readReply = (bytes: Uint8Array): Reply | null => {
  const fields = readObject(bytes);
  if (fields === null) return null;
  if (exactly(fields, 'silence')) return fields.get('silence') === 'true' ? { silence: true } : null;
  if (exactly(fields, 'quo')) {
    const text = fields.get('quo')!;
    const word = text.startsWith('"') ? (JSON.parse(text) as string) : null;
    return WORDS.find((w) => w === word) ? { quo: word as Word } : null;
  }
  if (exactly(fields, 'object', 'seen')) {
    const seen = fields.get('seen')!;
    if (seen === 'null') return { object: fields.get('object')!, seen: null };
    return seen.startsWith('"') ? { object: fields.get('object')!, seen: JSON.parse(seen) as string } : null;
  }
  return null;
};
