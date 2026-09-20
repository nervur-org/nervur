// SPDX-License-Identifier: Apache-2.0
// A being's `seen`: SHA-256, lowercase hex, over the canonical form of her
// blueprint for one asker. Keys sorted by UTF-16 code units, numbers as
// ECMAScript writes them, no whitespace.
import { hex, sha256, utf8, type Json } from '../crypto/index.ts';

export const canonical = (v: Json): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k]!)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
};

export const digest = async (blueprint: Json): Promise<string> => hex(await sha256(utf8(canonical(blueprint))));
