// SPDX-License-Identifier: Apache-2.0
// The payload: `{ to, by, next, seq, method?, args? }`. `args` is carried as
// the text it was written in, since Quo reads nothing inside it.
import { isCount, isHex, readObject } from '../crypto/index.ts';

export type Payload = {
  readonly to: string | null;
  readonly by: string;
  readonly next: string | null;
  readonly seq: number;
  readonly method?: string;
  readonly args?: string;
};

const OWED = ['to', 'by', 'next', 'seq'];
const ZERO = '0'.repeat(64);
const isPk = (text: string): boolean => isHex(text, 32) && text !== ZERO;

// A pk written as a JSON string, or null written as null.
const pkOrNull = (text: string, nullable: boolean): string | null | undefined => {
  if (nullable && text === 'null') return null;
  if (!/^"[0-9a-f]{64}"$/.test(text)) return undefined;
  const pk = text.slice(1, -1);
  return isPk(pk) ? pk : undefined;
};

export const writePayload = (p: Payload): string => {
  const parts = [`"to":${JSON.stringify(p.to)}`, `"by":"${p.by}"`, `"next":${JSON.stringify(p.next)}`, `"seq":${p.seq}`];
  if (p.method !== undefined) parts.push(`"method":${JSON.stringify(p.method)}`);
  if (p.args !== undefined) parts.push(`"args":${p.args}`);
  return `{${parts.join(',')}}`;
};

export type PayloadRead = { payload: Payload } | { fault: 'not an object' | 'not well formed' };

// Cases 2 and 3 of the door, before the head is compared.
export const readPayload = (bytes: Uint8Array): PayloadRead => {
  const fields = readObject(bytes);
  if (fields === null) return { fault: 'not an object' };
  const bad = { fault: 'not well formed' } as const;
  if (!OWED.every((f) => fields.has(f))) return bad;
  const to = pkOrNull(fields.get('to')!, true);
  const by = pkOrNull(fields.get('by')!, false);
  const next = pkOrNull(fields.get('next')!, true);
  const seq = fields.get('seq')!;
  if (to === undefined || !by || next === undefined || !isCount(seq)) return bad;
  const method = fields.get('method');
  if (method !== undefined && !method.startsWith('"')) return bad;
  const args = fields.get('args');
  if (args !== undefined && !args.startsWith('{')) return bad;
  return {
    payload: {
      to,
      by,
      next,
      seq: Number(seq),
      ...(method === undefined ? {} : { method: JSON.parse(method) as string }),
      ...(args === undefined ? {} : { args }),
    },
  };
};
