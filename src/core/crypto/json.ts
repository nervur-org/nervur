// SPDX-License-Identifier: Apache-2.0
// JSON text as the spec's values chapter reads it. Two readers, for two
// jobs:
//
//   readObject   Quo's reading of a payload, a reply text or an invitation:
//                UTF-8 with no byte order mark, one object, no two own keys
//                of one name, and every field kept as the text it was
//                written in. What is inside a field is held to the grammar
//                alone, at any depth, and read no further.
//
//   readValue    Nervur's reading of a text it hands to a being: the
//                grammar, a nesting bound, no two keys of one name at any
//                depth, no lone surrogate, and no number a double does not
//                hold as written. Anything else is undefined, since null
//                is a value.
//
// A runtime's own parser keeps the last of two keys, rounds numbers and
// mends bad bytes, which is where two kits stop agreeing, so neither reader
// trusts it with more than the escapes of one string.
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// A field's value exactly as it stood in the text, by its key.
export type Fields = ReadonlyMap<string, string>;

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const ESCAPE = /\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/y;
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const LITERALS = ['true', 'false', 'null'];

const skip = (s: string, at: number): number => {
  while (at < s.length && ' \t\n\r'.includes(s[at]!)) at += 1;
  return at;
};

// The end of the string opening at `at`, or -1.
const stringEnd = (s: string, at: number): number => {
  if (s[at] !== '"') return -1;
  for (at += 1; at < s.length; ) {
    const c = s.charCodeAt(at);
    if (c === 0x22) return at + 1;
    if (c < 0x20) return -1;
    if (c !== 0x5c) {
      at += 1;
      continue;
    }
    ESCAPE.lastIndex = at;
    if (!ESCAPE.test(s)) return -1;
    at = ESCAPE.lastIndex;
  }
  return -1;
};

const scalarEnd = (s: string, at: number): number => {
  if (s[at] === '"') return stringEnd(s, at);
  const literal = LITERALS.find((word) => s.startsWith(word, at));
  if (literal) return at + literal.length;
  NUMBER.lastIndex = at;
  return NUMBER.test(s) ? NUMBER.lastIndex : -1;
};

// A key, its colon and the space after it: the start of the key's value, or -1.
const keyEnd = (s: string, at: number): number => {
  const end = stringEnd(s, at);
  if (end < 0) return -1;
  const colon = skip(s, end);
  return s[colon] === ':' ? skip(s, colon + 1) : -1;
};

// The end of the value starting at `at`, held to the grammar at any depth
// without recursion, or -1.
const valueEnd = (s: string, at: number): number => {
  const open: string[] = [];
  for (;;) {
    const c = s[at];
    if (c === '{' || c === '[') {
      at = skip(s, at + 1);
      if (s[at] === (c === '{' ? '}' : ']')) at += 1;
      else {
        open.push(c);
        if (c === '{' && (at = keyEnd(s, at)) < 0) return -1;
        continue;
      }
    } else if ((at = scalarEnd(s, at)) < 0) return -1;
    for (;;) {
      if (open.length === 0) return at;
      at = skip(s, at);
      const top = open.at(-1);
      if (s[at] === ',') {
        at = skip(s, at + 1);
        if (top === '{' && (at = keyEnd(s, at)) < 0) return -1;
        break;
      }
      if (s[at] !== (top === '{' ? '}' : ']')) return -1;
      open.pop();
      at += 1;
    }
  }
};

const text = (input: Uint8Array | string): string | null => {
  if (typeof input === 'string') return input;
  try {
    return decoder.decode(input);
  } catch {
    return null;
  }
};

export const readObject = (input: Uint8Array | string): Fields | null => {
  const s = text(input);
  if (s === null) return null;
  const fields = new Map<string, string>();
  let at = skip(s, 0);
  if (s[at] !== '{') return null;
  at = skip(s, at + 1);
  if (s[at] === '}') return skip(s, at + 1) === s.length ? fields : null;
  for (;;) {
    const keyStart = at;
    const valueStart = keyEnd(s, at);
    if (valueStart < 0) return null;
    const key = JSON.parse(s.slice(keyStart, stringEnd(s, keyStart))) as string;
    if (fields.has(key)) return null;
    const end = valueEnd(s, valueStart);
    if (end < 0) return null;
    fields.set(key, s.slice(valueStart, end));
    at = skip(s, end);
    if (s[at] === '}') return skip(s, at + 1) === s.length ? fields : null;
    if (s[at] !== ',') return null;
    at = skip(s, at + 1);
  }
};

// A number text a double holds as written: a fraction, or a whole number
// the double it reads as is exactly, never past the largest double, never
// a value that rounds to zero, never minus zero.
const exactNumber = (literal: string): boolean => {
  const [, sign, whole, frac = '', exp = '0'] = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(literal)!;
  const v = Number(literal);
  if (!Number.isFinite(v)) return false;
  const digits = (whole! + frac).replace(/^0+/, '');
  if (v === 0) return digits === '' && sign === '';
  const trimmed = digits.replace(/0+$/, '');
  const e = BigInt(exp) - BigInt(frac.length) + BigInt(digits.length - trimmed.length);
  if (e < 0n) return true;
  return BigInt(trimmed) * 10n ** e === (v < 0 ? -BigInt(v) : BigInt(v)) || literal === String(v);
};

const depthOf = (s: string): number => {
  let depth = 0;
  let deepest = 0;
  for (let at = 0; at < s.length; at += 1) {
    const c = s[at];
    if (c === '"') at = stringEnd(s, at) - 1;
    else if (c === '{' || c === '[') deepest = Math.max(deepest, (depth += 1));
    else if (c === '}' || c === ']') depth -= 1;
  }
  return deepest;
};

// Parses a text already held to the grammar and to the depth bound.
const parse = (s: string): Json => {
  let at = 0;
  const value = (): Json => {
    at = skip(s, at);
    const c = s[at];
    if (c === '{' || c === '[') {
      const object = c === '{';
      const out: Json[] | Record<string, Json> = object ? {} : [];
      at = skip(s, at + 1);
      if (s[at] === (object ? '}' : ']')) {
        at += 1;
        return out;
      }
      for (;;) {
        if (object) {
          const key = str();
          if (Object.hasOwn(out, key)) throw new Error('two keys of one name');
          at = skip(s, at) + 1;
          Object.defineProperty(out, key, { value: value(), enumerable: true, writable: true, configurable: true });
        } else (out as Json[]).push(value());
        at = skip(s, at);
        if (s[at++] !== ',') return out;
      }
    }
    if (c === '"') return str();
    const end = scalarEnd(s, at);
    const literal = s.slice(at, end);
    at = end;
    if (LITERALS.includes(literal)) return JSON.parse(literal) as Json;
    if (!exactNumber(literal)) throw new Error('a number no double holds as written');
    return Number(literal);
  };
  const str = (): string => {
    at = skip(s, at);
    const end = stringEnd(s, at);
    const out = JSON.parse(s.slice(at, end)) as string;
    if (LONE.test(out)) throw new Error('a lone surrogate');
    at = end;
    return out;
  };
  return value();
};

export const readValue = (input: Uint8Array | string, depth: number): Json | undefined => {
  const s = text(input);
  if (s === null) return undefined;
  const start = skip(s, 0);
  const end = valueEnd(s, start);
  if (end < 0 || skip(s, end) !== s.length || depthOf(s) > depth) return undefined;
  try {
    return parse(s);
  } catch {
    return undefined;
  }
};

// A value as JSON text, or undefined for one that JSON would drop, rewrite
// or refuse: anything but null, a boolean, a finite number other than minus
// zero, well-formed text, a list with no holes, or a plain object of own
// string keys, nested no deeper than `depth`, with no cycle.
export const writeValue = (value: unknown, depth: number): string | undefined => {
  const fits = (v: unknown, room: number, path: Set<object>): boolean => {
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'string') return !LONE.test(v);
    if (typeof v === 'number') return Number.isFinite(v) && !Object.is(v, -0);
    if (typeof v !== 'object' || room === 0 || path.has(v)) return false;
    path.add(v);
    const ok = Array.isArray(v)
      ? Object.keys(v).length === v.length && v.every((x) => fits(x, room - 1, path))
      : [Object.prototype, null].includes(Object.getPrototypeOf(v)) &&
        Object.getOwnPropertySymbols(v).length === 0 &&
        Object.entries(Object.getOwnPropertyDescriptors(v)).every(([k, d]) => !LONE.test(k) && d.enumerable === true && 'value' in d && fits(d.value, room - 1, path));
    path.delete(v);
    return ok;
  };
  return fits(value, depth, new Set()) ? JSON.stringify(value) : undefined;
};

// A count number: no sign, no fraction, no exponent, from 1 to 2^53 - 1.
export const isCount = (literal: string): boolean => /^[1-9]\d{0,15}$/.test(literal) && Number(literal) <= Number.MAX_SAFE_INTEGER;
