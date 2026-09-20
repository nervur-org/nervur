// SPDX-License-Identifier: Apache-2.0
// A being's cells, guarded. Her cells are kept by whatever memory her
// terrain gives, and a memory that writes JSON would hand back something
// other than what she wrote if she wrote anything JSON cannot hold. So a
// write that is not a value throws where she wrote it, in her own frame,
// and her answer becomes silence like any throw.
//
// What passes is stored as a fresh copy of its JSON text, so a reference
// she kept to what she wrote is not a way around the guard. Every key lands
// as an own key, `__proto__` included. A list grows at its end: a slot or a
// length past it would leave a hole.
import { writeValue, type Json } from '../crypto/index.ts';
import type { JsonObject } from '../being/index.ts';

export const DEPTH = 64;

const refuse = (why: string): never => {
  throw new TypeError(`cells hold values: ${why}`);
};

const copy = (value: unknown, room: number, where: string): Json => {
  const text = writeValue(value, room);
  return text === undefined ? refuse(`${where} is not a value JSON keeps, within ${room} levels`) : (JSON.parse(text) as Json);
};

export class Cells {
  readonly #guards = new WeakMap<object, object>();
  readonly #wrote: () => void;

  constructor(wrote: () => void) {
    this.#wrote = wrote;
  }

  // The guarded view of a being's cells.
  guard(cells: JsonObject): JsonObject {
    return this.#guard(cells, 'cells', 1);
  }

  #guard<T extends object>(target: T, path: string, level: number): T {
    const had = this.#guards.get(target);
    if (had) return had as T;
    const room = DEPTH - level;
    const place = (t: T, k: string | symbol, value: unknown): boolean => {
      if (typeof k !== 'string') return refuse(`${path} takes no symbol key`);
      const where = `${path}.${k}`;
      if (Array.isArray(t)) {
        if (k === 'length') {
          if (typeof value !== 'number' || value > t.length) refuse(`${where} past its end would leave a hole`);
          t.length = value as number;
          this.#wrote();
          return true;
        }
        if (!/^(0|[1-9]\d*)$/.test(k)) refuse(`${where} is not a slot of a list`);
        if (Number(k) > t.length) refuse(`${where} would leave a hole`);
      }
      const ok = Reflect.defineProperty(t, k, { value: copy(value, room, where), enumerable: true, writable: true, configurable: true });
      this.#wrote();
      return ok;
    };
    const proxy = new Proxy(target, {
      get: (t, k, r) => {
        const v: unknown = Reflect.get(t, k, r);
        return typeof k === 'string' && Object.hasOwn(t, k) && typeof v === 'object' && v !== null ? this.#guard(v, `${path}.${k}`, level + 1) : v;
      },
      set: (t, k, v) => place(t, k, v),
      defineProperty: (t, k, d) => ('value' in d ? place(t, k, d.value) : refuse(`${path}.${String(k)} is an accessor`)),
      deleteProperty: (t, k) => {
        const ok = Reflect.deleteProperty(t, k);
        this.#wrote();
        return ok;
      },
      setPrototypeOf: () => refuse(`${path} keeps its prototype`),
    });
    this.#guards.set(target, proxy);
    return proxy;
  }
}
