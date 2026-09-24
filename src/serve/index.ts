// SPDX-License-Identifier: Apache-2.0
// `nervur/serve`: the program's side of the bridge, for a faculty written
// in JavaScript and run beside a ground. It answers `describe` with the
// blueprint, and every other line with the method it names. A method
// receives its args and a context: the call id, and a way to call a
// handle it was handed.
import { createInterface } from 'node:readline';
import type { Json } from '../being/being.ts';
import { blueprintOf } from '../being/need.ts';

/** What a served method receives beside its args. */
export interface ServeContext {
  /** The call id: the same on every attempt of one call, so a repeat acts once. */
  readonly id: string;
  /** A handle the program was handed, called; its answer, or its error. */
  call(token: string, args?: Json): Promise<{ result: Json } | { error: { message: string } }>;
}

type Method = (args: { readonly [key: string]: Json }, context: ServeContext) => Json | Promise<Json>;

/**
 * Serves `methods` on the standard streams under `need`'s blueprint, and
 * `window`, how long the program remembers a call id. A method that
 * throws answers an error, which is final; a program that must be asked
 * again exits instead, and the ground starts it again.
 */
export const serve = (need: unknown, methods: Readonly<Record<string, Method>>, { window }: { window?: number } = {}): void => {
  const blueprint = blueprintOf(need);
  if (blueprint === undefined) throw new TypeError('serve takes a need');
  const write = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`);
  const waiting = new Map<string, (answer: { result: Json } | { error: { message: string } }) => void>();
  let next = 0;
  createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', (line) => {
    const message = JSON.parse(line) as { id: unknown; method?: string; args?: { readonly [key: string]: Json }; call?: string; result?: Json; error?: { message: string } };
    // The house's answer to a handle this program called.
    if (message.method === undefined) {
      const answered = waiting.get(String(message.id));
      waiting.delete(String(message.id));
      answered?.('error' in message && message.error !== undefined ? { error: message.error } : { result: message.result ?? null });
      return;
    }
    if (message.method === 'describe') {
      write({ id: message.id, result: { blueprint: JSON.parse(JSON.stringify(blueprint)) as Json, ...(window === undefined ? {} : { window }) } });
      return;
    }
    const method = methods[message.method];
    const context: ServeContext = {
      id: message.call ?? '',
      call: (token, args = {}) =>
        new Promise((resolve) => {
          const id = `p${++next}`;
          waiting.set(id, resolve);
          write({ id, token, args });
        }),
    };
    void (async () => {
      if (method === undefined) return write({ id: message.id, error: { message: `no method ${message.method}` } });
      try {
        write({ id: message.id, result: await method(message.args ?? {}, context) });
      } catch (error) {
        write({ id: message.id, error: { message: error instanceof Error ? error.message : String(error) } });
      }
    })();
  });
};
