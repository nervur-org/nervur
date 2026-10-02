// SPDX-License-Identifier: Apache-2.0
// A stand-in: the far side of a standing she holds, made from the need she
// declares for it and answered by her author's handlers. The bench names
// this module with a query, its kind, the need as JSON and the handlers'
// module, and the house loads it in its own runner. So the handlers run
// where every class of the house runs, and code crosses only as a module.
// A stand-in keeps what she asked in its cells, which a test reads.
import { Being, s, type Json } from '../being/index.ts';

/** One method of her need, as its author wrote it. */
interface Spec {
  readonly args?: Json;
  readonly result?: Json;
  readonly readOnly?: boolean;
  readonly idempotent?: boolean;
}

/** Her author's handlers, each by the method it answers: args in, the result out, and a throw refusing it. */
type Handlers = Readonly<Record<string, ((args: Json) => unknown) | undefined>>;

/** The stand-in's class, its asks those of the need, each open to every occupant. */
export const standIn = (kind: string, methods: Readonly<Record<string, Spec>>, handlers: Handlers): unknown => {
  const asks = Object.fromEntries(
    Object.entries(methods).map(([method, spec]) => [
      method,
      {
        // Awaited where her need awaits it, so a need matched to its describe is covered.
        idempotent: spec.readOnly === true || spec.idempotent === true,
        args: spec.args ?? s.object({}),
        ...(spec.result === undefined ? {} : { result: spec.result }),
      },
    ]),
  );
  const Base = Being.of({ kind, cells: { asked: [] as Json[] }, asks: asks as never }) as unknown as new () => { cells: { asked: Json[] }; fail(message: string): never };
  class StandIn extends Base {}
  for (const method of Object.keys(methods)) {
    Object.defineProperty(StandIn.prototype, method, {
      value: async function (this: InstanceType<typeof Base>, args: Json) {
        let result: unknown;
        try {
          result = await handlers[method]?.(args);
        } catch (error) {
          this.fail(error instanceof Error ? error.message : String(error));
        }
        this.cells.asked = [...this.cells.asked, { method, args }];
        return result ?? null;
      },
    });
  }
  return StandIn;
};

// The stand-in this module was named for, where a query names one.
const named = new URL(import.meta.url).searchParams;
const kind = named.get('kind');
const need = named.get('need');
const handlers = named.get('handlers');

/** The stand-in the query names, or none where the module is loaded plainly. */
export const beings: readonly unknown[] =
  kind === null || need === null || handlers === null ? [] : [standIn(kind, JSON.parse(need) as Record<string, Spec>, (await import(handlers)) as Handlers)];

/** This module, which the bench names with a query for each stand-in. */
export const STAND_IN = new URL(import.meta.url).href.split('?')[0];
