// SPDX-License-Identifier: Apache-2.0
// `nervur/serve`: the program's side of the bridge, for a faculty written
// in JavaScript and run beside a ground. It answers `describe` with the
// blueprint, and every other line with the method it names. A method
// receives its args and a context: the call id, a way to call a handle it
// was handed, and the faculty's memory.
import { createInterface } from 'node:readline';
import type { Json } from '../being/being.ts';
import { blueprintOf } from '../being/need.ts';

type Answered = { result: Json } | { error: { message: string } };

/** The faculty's memory, as its lines reach it: every entry's bytes in lowercase hex. */
interface ServedMemory {
  read(place: string): Promise<{ entries: Record<string, string>; version: string | null }>;
  list(): Promise<string[]>;
  /** Each written place's new version, or `null` where the versions moved and nothing landed. */
  write(writes: Record<string, Record<string, string | null>>, expect: Record<string, string | null>): Promise<Record<string, string | null> | null>;
}

/** What a served method receives beside its args. */
interface ServeContext {
  /** The call id: the same on every attempt of one call, so a repeat acts once. */
  readonly id: string;
  /**
   * A handle the program was handed, called; its answer, or its error. Its
   * call id is `id` where given, and otherwise this call's own id and the
   * count of handles it has called, so the same on every attempt of this
   * call, in any life of the program.
   */
  call(token: string, args?: Json, id?: string): Promise<Answered>;
  /** The faculty's own memory, sealed by the ground; a line the ground refuses throws. */
  readonly memory: ServedMemory;
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
  const waiting = new Map<string, (answer: Answered) => void>();
  let next = 0;
  // One line of the program's own, and the ground's answer to it.
  const asked = (line: Record<string, Json>): Promise<Answered> =>
    new Promise((resolve) => {
      const sent = `p${++next}`;
      waiting.set(sent, resolve);
      write({ id: sent, ...line });
    });
  const remembered = async (op: string, args: Json): Promise<Json> => {
    const answer = await asked({ memory: op, args });
    if ('error' in answer) throw new Error(answer.error.message);
    return answer.result;
  };
  const memory: ServedMemory = {
    read: async (place) => (await remembered('read', { place })) as { entries: Record<string, string>; version: string | null },
    list: async () => (await remembered('list', {})) as string[],
    write: async (writes, expect) => (await remembered('write', { writes, expect })) as Record<string, string | null> | null,
  };
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
    const served = message.call ?? '';
    let called = 0;
    const context: ServeContext = {
      id: served,
      call: (token, args = {}, id = served === '' ? '' : `${served}:${++called}`) =>
        id === '' ? Promise.resolve({ error: { message: 'a handle is called with a call id of the program’s own' } }) : asked({ token, args, call: id }),
      memory,
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
