// SPDX-License-Identifier: Apache-2.0
// A packfile, version 2, read into its objects: each entry a header of its
// type and size, then a zlib stream, and a SHA-1 of it all at the end. A
// delta names its base by the distance back to it in the pack, OFS_DELTA,
// or by its id, REF_DELTA, which may name an object the reader holds
// already.
import { hex, utf8 } from '../crypto/bytes.ts';
import { idOf, sha1, type GitObject, type ObjectType } from './object.ts';
import { inflateAt } from './zlib.ts';

const KINDS: Record<number, ObjectType> = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' };
const OFS_DELTA = 6;
const REF_DELTA = 7;

// A delta's instructions laid over its base.
export const applyDelta = (base: Uint8Array, delta: Uint8Array): Uint8Array => {
  let at = 0;
  const size = (): number => {
    let n = 0;
    let shift = 0;
    for (let b = 0x80; b & 0x80; shift += 7) {
      b = delta[at++]!;
      n += (b & 0x7f) * 2 ** shift;
    }
    return n;
  };
  if (size() !== base.length) throw new Error('a delta for another base');
  const out = new Uint8Array(size());
  let written = 0;
  while (at < delta.length) {
    const op = delta[at++]!;
    if (op & 0x80) {
      let offset = 0;
      let length = 0;
      for (let k = 0; k < 4; k += 1) if (op & (1 << k)) offset |= delta[at++]! << (8 * k);
      for (let k = 0; k < 3; k += 1) if (op & (0x10 << k)) length |= delta[at++]! << (8 * k);
      if (length === 0) length = 0x10000;
      offset >>>= 0;
      if (offset + length > base.length || written + length > out.length) throw new Error('a delta copy past its bounds');
      out.set(base.subarray(offset, offset + length), written);
      written += length;
    } else if (op !== 0) {
      if (at + op > delta.length || written + op > out.length) throw new Error('a delta insert past its bounds');
      out.set(delta.subarray(at, at + op), written);
      written += op;
      at += op;
    } else throw new Error('a delta op of nothing');
  }
  if (written !== out.length) throw new Error('a delta short of its size');
  return out;
};

type Entry = { type: number; data: Uint8Array; base?: number | string };

// Every object a pack holds, by id. `outside` finds a REF_DELTA's base the
// pack does not carry.
export const readPack = async (pack: Uint8Array, outside: (id: string) => Promise<GitObject | null> = () => Promise.resolve(null)): Promise<Map<string, GitObject>> => {
  if (pack.length < 32 || new TextDecoder().decode(pack.subarray(0, 4)) !== 'PACK') throw new Error('no pack');
  const word = (at: number): number => ((pack[at]! << 24) | (pack[at + 1]! << 16) | (pack[at + 2]! << 8) | pack[at + 3]!) >>> 0;
  if (word(4) !== 2) throw new Error('a pack of another version');
  const count = word(8);
  const body = pack.subarray(0, pack.length - 20);
  if ((await sha1(body)) !== hex(pack.subarray(pack.length - 20))) throw new Error('a pack whose sum does not check');
  const entries = new Map<number, Entry>();
  let at = 12;
  for (let n = 0; n < count; n += 1) {
    const start = at;
    let b = pack[at++]!;
    const type = (b >> 4) & 7;
    let size = b & 15;
    for (let shift = 4; b & 0x80; shift += 7) {
      b = pack[at++]!;
      size += (b & 0x7f) * 2 ** shift;
    }
    let base: number | string | undefined;
    if (type === OFS_DELTA) {
      b = pack[at++]!;
      let back = b & 0x7f;
      while (b & 0x80) {
        b = pack[at++]!;
        back = (back + 1) * 128 + (b & 0x7f);
      }
      base = start - back;
    } else if (type === REF_DELTA) {
      base = hex(pack.subarray(at, at + 20));
      at += 20;
    } else if (!KINDS[type]) throw new Error(`a pack entry of type ${String(type)}`);
    const { out, end } = inflateAt(body, at);
    if (out.length !== size) throw new Error('a pack entry of another size');
    at = end;
    entries.set(start, { type, data: out, ...(base === undefined ? {} : { base }) });
  }
  if (at !== body.length) throw new Error('a pack with bytes past its objects');
  // Pass after pass, every entry whose base stands now is laid over it,
  // until every entry stands or a pass stands none.
  const byOffset = new Map<number, GitObject>();
  const byId = new Map<string, GitObject>();
  const outsiders = new Map<string, GitObject | null>();
  const baseOf = async (base: number | string): Promise<GitObject | undefined> => {
    if (typeof base === 'number') return byOffset.get(base);
    const inside = byId.get(base);
    if (inside) return inside;
    if (!outsiders.has(base)) outsiders.set(base, await outside(base));
    return outsiders.get(base) ?? undefined;
  };
  while (byOffset.size < entries.size) {
    const before = byOffset.size;
    for (const [offset, e] of entries) {
      if (byOffset.has(offset)) continue;
      let o: GitObject;
      if (e.base === undefined) o = { type: KINDS[e.type]!, body: e.data };
      else {
        const base = await baseOf(e.base);
        if (!base) continue;
        o = { type: base.type, body: applyDelta(base.body, e.data) };
      }
      byOffset.set(offset, o);
      byId.set(await idOf(o), o);
    }
    if (byOffset.size === before) throw new Error('a delta whose base is nowhere');
  }
  return byId;
};

// pkt-lines, as git's protocols frame them: four hex digits of length,
// itself counted, and `0000` for a flush.
export const pkt = (line: string): Uint8Array => {
  const bytes = utf8(line);
  return new Uint8Array([...utf8((bytes.length + 4).toString(16).padStart(4, '0')), ...bytes]);
};
export const FLUSH = utf8('0000');

// The lines of a pkt-line stream up to its first flush, and where it ends.
export const readPkts = (bytes: Uint8Array, at = 0, stop = (_line: string) => false): { lines: string[]; end: number } => {
  const lines: string[] = [];
  while (at + 4 <= bytes.length) {
    const length = parseInt(new TextDecoder().decode(bytes.subarray(at, at + 4)), 16);
    if (Number.isNaN(length)) throw new Error('no pkt-line');
    if (length === 0) return { lines, end: at + 4 };
    if (length < 4 || at + length > bytes.length) throw new Error('a pkt-line cut short');
    const line = new TextDecoder().decode(bytes.subarray(at + 4, at + length));
    lines.push(line);
    at += length;
    if (stop(line)) return { lines, end: at };
  }
  return { lines, end: at };
};
