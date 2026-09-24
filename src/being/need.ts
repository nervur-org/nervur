// SPDX-License-Identifier: Apache-2.0
// A need: a blueprint at its minimum, the shape of what she calls.
import { s, type Schema } from './schema.ts';

/** The three hints an ask or a method may carry. */
export interface Hints {
  readonly readOnly?: boolean;
  readonly idempotent?: boolean;
  readonly destructive?: boolean;
}

/** A method as its author writes it, in a need or in an ask's entry. */
export interface MethodSpec {
  readonly args?: Schema;
  readonly result?: Schema;
  readonly hints?: Hints;
  readonly description?: string;
  /** How long an awaited caller waits for it, in milliseconds, within the bound. */
  readonly wait?: number;
}

/** A method of a blueprint, every field settled. */
export interface BlueprintMethod {
  readonly args: Schema;
  readonly result?: Schema;
  readonly hints: Required<Hints>;
  readonly description?: string;
  readonly wait: number;
}

/** An awaited call's wait where none is named, and the bound no wait passes. */
export const WAIT = 30_000;
export const WAIT_BOUND = 300_000;

/** The shape of what can be called: a name and its methods. */
export interface Blueprint {
  readonly name: string;
  readonly methods: Readonly<Record<string, BlueprintMethod>>;
}

export const BLUEPRINT: unique symbol = Symbol('blueprint');

/** A need: her methods by name, and the blueprint they make. */
export type Need<M extends Record<string, MethodSpec> = Record<string, MethodSpec>> = { readonly [K in keyof M]: M[K] } & {
  readonly [BLUEPRINT]: Blueprint;
};

/** Whether a method is awaited: `readOnly` implies `idempotent`. */
export const awaited = (hints: Hints | undefined): boolean => hints?.idempotent === true || hints?.readOnly === true;

/** Hints settled, `readOnly` carrying `idempotent` with it. */
export const settled = (hints: Hints | undefined): Required<Hints> => ({
  readOnly: hints?.readOnly === true,
  idempotent: awaited(hints),
  destructive: hints?.destructive === true,
});

/** One method settled: the empty object where args are omitted. */
export const method = (spec: MethodSpec): BlueprintMethod =>
  Object.freeze({
    args: spec.args ?? s.object({}),
    ...(spec.result === undefined ? {} : { result: spec.result }),
    hints: Object.freeze(settled(spec.hints)),
    ...(spec.description === undefined ? {} : { description: spec.description }),
    wait: typeof spec.wait === 'number' ? Math.min(spec.wait, WAIT_BOUND) : WAIT,
  });

/** A blueprint at its minimum, under the name matching uses. */
export const need = <const M extends Record<string, MethodSpec>>(name: string, methods: M): Need<M> => {
  const blueprint: Blueprint = Object.freeze({
    name,
    methods: Object.freeze(Object.fromEntries(Object.entries(methods).map(([key, spec]) => [key, method(spec)]))),
  });
  return Object.freeze({ ...methods, [BLUEPRINT]: blueprint });
};

/** The blueprint a need makes, or nothing where the value is no need. */
export const blueprintOf = (value: unknown): Blueprint | undefined =>
  typeof value === 'object' && value !== null && BLUEPRINT in value ? (value as Need)[BLUEPRINT] : undefined;
