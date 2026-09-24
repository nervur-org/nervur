// SPDX-License-Identifier: Apache-2.0
// The default tools: UTF-8 read fatally, lowercase hex, RFC 8259 read with
// every key kept apart, and one canonical spelling of a value.
import type { Parsed, Tools } from '../foundation.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const HEX = /^(?:[0-9a-f]{2})*$/;
const NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const ESCAPES: Readonly<Record<string, string>> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

type Frame = { readonly object: true; readonly value: Record<string, unknown>; readonly keys: Set<string>; key: string; start: number } | { readonly object: false; readonly value: unknown[] };

const define = (target: Record<string, unknown>, key: string, value: unknown) =>
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });

// An iterative reader, so no nesting a sender writes can exhaust the stack.
const read = (text: string): Parsed | null => {
  const length = text.length;
  let at = 0;
  let duplicate = false;
  let nestedDuplicate = false;
  let fields: Record<string, string> | null = null;
  const stack: Frame[] = [];

  const space = () => {
    while (at < length) {
      const code = text.charCodeAt(at);
      if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return;
      at++;
    }
  };

  const string = (): string | null => {
    if (text[at] !== '"') return null;
    at++;
    let out = '';
    let from = at;
    while (at < length) {
      const code = text.charCodeAt(at);
      if (code === 0x22) {
        out += text.slice(from, at);
        at++;
        return out;
      }
      if (code < 0x20) return null;
      if (code === 0x5c) {
        out += text.slice(from, at);
        const escape = text[at + 1];
        if (escape === 'u') {
          const digits = text.slice(at + 2, at + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) return null;
          out += String.fromCharCode(Number.parseInt(digits, 16));
          at += 6;
        } else {
          const plain = escape === undefined ? undefined : ESCAPES[escape];
          if (plain === undefined) return null;
          out += plain;
          at += 2;
        }
        from = at;
        continue;
      }
      at++;
    }
    return null;
  };

  const key = (frame: Frame & { object: true }): boolean => {
    const name = string();
    if (name === null) return false;
    space();
    if (text[at] !== ':') return false;
    at++;
    space();
    if (frame.keys.has(name)) {
      if (stack[0] === frame) duplicate = true;
      else nestedDuplicate = true;
    }
    frame.keys.add(name);
    frame.key = name;
    frame.start = at;
    return true;
  };

  for (;;) {
    space();
    let value: unknown;
    const char = text[at];
    if (char === '{') {
      at++;
      space();
      const frame = { object: true as const, value: {}, keys: new Set<string>(), key: '', start: 0 };
      if (text[at] === '}') {
        at++;
        value = frame.value;
      } else {
        stack.push(frame);
        if (stack.length === 1) fields = Object.create(null) as Record<string, string>;
        if (!key(frame)) return null;
        continue;
      }
    } else if (char === '[') {
      at++;
      space();
      if (text[at] === ']') {
        at++;
        value = [];
      } else {
        stack.push({ object: false, value: [] });
        continue;
      }
    } else if (char === '"') {
      value = string();
      if (value === null) return null;
    } else if (text.startsWith('true', at)) {
      at += 4;
      value = true;
    } else if (text.startsWith('false', at)) {
      at += 5;
      value = false;
    } else if (text.startsWith('null', at)) {
      at += 4;
      value = null;
    } else {
      NUMBER.lastIndex = at;
      const number = NUMBER.exec(text);
      if (number === null) return null;
      at += number[0].length;
      value = Number(number[0]);
    }

    // The value is whole: set it in its container, and close what it ends.
    for (;;) {
      const top = stack.at(-1);
      if (top === undefined) {
        space();
        if (at !== length) return null;
        if (!(typeof value === 'object' && value !== null && !Array.isArray(value))) fields = null;
        return { value, fields, duplicate, nestedDuplicate };
      }
      if (top.object) {
        if (stack.length === 1 && fields !== null) fields[top.key] = text.slice(top.start, at);
        define(top.value, top.key, value);
        space();
        if (text[at] === ',') {
          at++;
          space();
          if (!key(top)) return null;
          break;
        }
        if (text[at] !== '}') return null;
      } else {
        top.value.push(value);
        space();
        if (text[at] === ',') {
          at++;
          break;
        }
        if (text[at] !== ']') return null;
      }
      at++;
      stack.pop();
      value = top.value;
    }
  }
};

const canonical = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('a number that is not finite has no JSON');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  throw new TypeError('the value is not JSON');
};

export class StrictTools implements Tools {
  utf8(text: string): Uint8Array {
    return encoder.encode(text);
  }

  text(bytes: Uint8Array): string | null {
    try {
      return decoder.decode(bytes);
    } catch {
      return null;
    }
  }

  hex(bytes: Uint8Array): string {
    let out = '';
    for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
    return out;
  }

  bytes(hex: string): Uint8Array | null {
    if (typeof hex !== 'string' || !HEX.test(hex)) return null;
    const out = new Uint8Array(hex.length / 2);
    for (let at = 0; at < out.length; at++) out[at] = Number.parseInt(hex.slice(at * 2, at * 2 + 2), 16);
    return out;
  }

  parse(text: string): Parsed | null {
    return read(text);
  }

  canonical(value: unknown): string {
    return canonical(value);
  }

  check(schema: unknown, value: unknown): string | null {
    return check(schema as Node, value, 'the value');
  }
}

type Node = Readonly<Record<string, unknown>>;

const typeOf = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

// The closed subset, read as JSON Schema 2020-12 reads it.
const check = (schema: Node, value: unknown, at: string): string | null => {
  if (typeof schema !== 'object' || schema === null) return `${at} meets no schema`;
  const type = schema.type as string | undefined;
  if (type !== undefined) {
    const actual = typeOf(value);
    const fits = actual === type || (type === 'number' && actual === 'integer');
    if (!fits) return `${at} is not ${type === 'integer' || type === 'array' || type === 'object' ? 'an' : 'a'} ${type}`;
  }
  if ('const' in schema && schema.const !== value) return `${at} is not ${JSON.stringify(schema.const)}`;
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return `${at} is none of ${JSON.stringify(schema.enum)}`;
  if (typeof value === 'string') {
    const length = [...value].length;
    if (typeof schema.minLength === 'number' && length < schema.minLength) return `${at} is shorter than ${schema.minLength}`;
    if (typeof schema.maxLength === 'number' && length > schema.maxLength) return `${at} is longer than ${schema.maxLength}`;
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) return `${at} does not match ${schema.pattern}`;
    if (schema.contentEncoding === 'base16' && !HEX.test(value)) return `${at} is not lowercase hex`;
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) return `${at} is below ${schema.minimum}`;
    if (typeof schema.maximum === 'number' && value > schema.maximum) return `${at} is above ${schema.maximum}`;
  }
  if (Array.isArray(value) && schema.items !== undefined) {
    for (let index = 0; index < value.length; index++) {
      const found = check(schema.items as Node, value[index], `${at}[${index}]`);
      if (found !== null) return found;
    }
  }
  if (typeOf(value) === 'object') {
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Node>;
    for (const key of (schema.required ?? []) as string[]) if (!Object.hasOwn(object, key)) return `${at}.${key} is missing`;
    for (const [key, field] of Object.entries(object)) {
      const inner = Object.hasOwn(properties, key) ? properties[key] : undefined;
      if (inner === undefined) {
        if (schema.additionalProperties === false) return `${at}.${key} is not allowed`;
        continue;
      }
      const found = check(inner, field, `${at}.${key}`);
      if (found !== null) return found;
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const reasons = schema.anyOf.map((branch) => check(branch as Node, value, at));
    if (!reasons.includes(null)) return reasons[0] ?? `${at} meets no branch`;
  }
  return null;
};
