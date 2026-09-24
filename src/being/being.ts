// SPDX-License-Identifier: Apache-2.0
// The class an author extends. `Being.of` keeps her declaration, and the
// house fills what she reaches when it wakes her for an ask.
import type { MethodSpec, Need, BLUEPRINT } from './need.ts';
import type { Handle, Inbound, Infer, Invitation, Outbound } from './schema.ts';

/** A JSON value, as cells and notes hold. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
/** What a call outward carries: JSON, bytes, and the handles and invitations the callee's schema places. */
export type Passed = Json | Uint8Array | Handle | Invitation | readonly Passed[] | { readonly [key: string]: Passed };

/** Notes on a relation. */
export type Notes = Readonly<Record<string, Json>>;

/** Where the house placed her. */
export type Position = 'steward' | 'public' | 'normal';

/** Who asks now. */
export interface Asker {
  readonly id: string;
  readonly notes: Notes;
  readonly steward: Notes;
  readonly signer?: Uint8Array;
}

/** What a role and her state read of her. */
export interface Me<C> {
  readonly id: string;
  readonly position: Position;
  readonly cells: Readonly<C>;
}

type Names = string | readonly string[];

/**
 * One example of an ask, run by the bench and nowhere else. `given` is the
 * history of her own asks that brings her from her `born` to where the
 * example starts.
 */
export interface Example {
  readonly description?: string;
  readonly given?: readonly { readonly ask: string; readonly args?: Json; readonly role?: string }[];
  readonly role?: string;
  readonly args?: Json;
  readonly fakes?: Json;
  readonly gives?: Json;
}

/** An ask's entry: the method's gate. */
export interface Entry extends MethodSpec {
  readonly in?: Names;
  readonly for?: Names;
  readonly to?: Names;
  readonly examples?: readonly Example[];
}

/** What a class declares. */
export interface Declaration<C = Record<string, Json>, N = Record<string, Need>, A = Record<string, Entry>> {
  readonly kind: string;
  readonly description?: string;
  readonly cells?: C;
  readonly needs?: N;
  readonly roles?: Readonly<Record<string, (asker: Asker, me: Me<C>) => boolean>>;
  readonly state?: (me: Me<C>) => string;
  readonly asks: A;
  /** Markup as text over her asks, which a screen renders. */
  readonly view?: string;
}

/** A relation, with her notes and her steward's. */
export interface Relation {
  readonly id: string;
  readonly notes: Notes;
  readonly steward: Notes;
}

type Resolved<S> = S extends { readonly result: infer R } ? Inbound<Infer<R>> : null;
type Sent<S> = S extends { readonly args: infer A } ? Outbound<Infer<A>> : Record<string, never>;
type IsAwaited<S> = S extends { readonly hints: { readonly idempotent: true } } ? true : S extends { readonly hints: { readonly readOnly: true } } ? true : false;

/** How she calls one method: awaited, or an effect answered through `reply`. */
// Args a method requires nothing of may be left out.
type Given<S, O extends unknown[]> = {} extends Sent<S> ? [args?: Sent<S>, ...O] : [args: Sent<S>, ...O];

type IsReadOnly<S> = S extends { readonly hints: { readonly readOnly: true } } ? true : false;

// A readOnly ask is watched when she passes the result she holds as `after`,
// awaited, or as an effect whose answer asks her `reply`.
export type Call<S, R extends string> =
  IsReadOnly<S> extends true
    ? ((...given: Given<S, [options: { after: Resolved<S>; reply: R }]>) => void) & ((...given: Given<S, [options?: { after?: Resolved<S> }]>) => Promise<Resolved<S>>)
    : IsAwaited<S> extends true
      ? (...given: Given<S, []>) => Promise<Resolved<S>>
      : (...given: Given<S, [options?: { reply?: R }]>) => void;

/** The frozen face of a need: its methods and nothing else. */
export type Face<X, R extends string = string> = { readonly [K in Exclude<keyof X, typeof BLUEPRINT>]: Call<X[K], R> };

/** A standing asked with no need matched, such as her steward. */
export type Untyped = Readonly<Record<string, (args?: Passed, options?: { reply?: string }) => Promise<unknown> | void>>;

/** One ask as a far being's describe shows it: its schemas, its hints and its wait. */
export interface Described {
  readonly method: string;
  readonly description?: string;
  readonly in?: readonly string[];
  readonly to?: readonly string[];
  readonly args?: Json;
  readonly result?: Json;
  readonly hints?: { readonly readOnly?: boolean; readonly idempotent?: boolean; readonly destructive?: boolean };
  readonly wait?: number;
}

/**
 * A standing asked with no need declared. `describe` reads what it shows
 * her now. `ask` names a method from the describe she read in this ask,
 * which says whether it is awaited or an effect.
 */
export interface Undeclared<R extends string = string> {
  describe(): Promise<{ readonly state: string; readonly asks: readonly Described[] }>;
  ask(method: string, args?: Passed, options?: { reply?: R; after?: unknown }): Promise<unknown> | undefined;
}

/** What a far public being is reached by: her ward, and her addresses in order. */
export interface Card {
  readonly ward: string;
  readonly at: readonly string[];
}

/**
 * A far public being asked as a stranger with no need declared. `describe`
 * reads what she shows a stranger now, and `ask` names a method from it.
 */
export interface Strange {
  describe(): Promise<{ readonly state: string; readonly asks: readonly Described[] }>;
  ask(method: string, args?: Passed): Promise<unknown>;
}

/** What `this.house` gives every being. */
export interface HouseReach<R extends string = string> {
  now(): number;
  random(options: { length: number }): Uint8Array;
  alarm(options: { at: number; ask: R; args?: Json; key: string }): void;
  cancelAlarm(options: { key: string }): void;
}

/** Her standings. */
export interface Standings {
  /** Each standing, with the domains that vouch for a far one's ward. */
  list(): readonly (Relation & { readonly vouched: readonly string[] })[];
  note(id: string, notes: Notes): void;
  drop(id: string): void;
}

/** Her occupants and handles. */
export interface Occupants {
  list(): readonly Relation[];
  note(id: string, notes: Notes): void;
  dismiss(id: string): void;
}

/** The steward's six powers. */
export interface Powers {
  /** A new occupant of another being, as a handle she may pass on. */
  invite(options: { id: string; occupant: string; notes?: Notes; expires?: number }): Handle;
  bear(options: { kind: string; id: string; args?: Json }): void;
  remove(options: { id: string }): void;
  /** Every being, her kind, whether she is absent, and the replies her table refused. */
  list(): Promise<readonly { id: string; kind: string; absent: boolean; dead: readonly { ask: string; args: Json; at: number; why: string }[] }[]>;
  /** Her args may carry a handle she holds or an invitation she carries, as any call outward. */
  ask(call: { id: string; method: string; args?: Passed }, options?: { reply?: string }): Promise<unknown> | void;
  /** With no method, the empty ask: what the being shows her steward now. */
  ask(call: { id: string }): Promise<{ readonly state: string; readonly asks: readonly Described[] }>;
  introduce(options: { from: string; to: string; notes?: Notes }): void;
}

export const DECLARATION: unique symbol = Symbol('declaration');
declare const ASKS: unique symbol;

/** The asks of a class, carried in its type alone. */
export interface Typed<A> {
  readonly [ASKS]?: A;
}

type AskOf<T, K> = T extends Typed<infer A> ? (K extends keyof A ? A[K] : never) : never;

/** The args her method `K` receives. */
export type Args<T, K extends string> = AskOf<T, K> extends { readonly args: infer S } ? Inbound<Infer<S>> : Record<string, never>;

/** What her method `K` answers. */
export type Result<T, K extends string> = AskOf<T, K> extends { readonly result: infer S } ? Outbound<Infer<S>> : void;

/** What every being reaches. */
export abstract class Being<C = Record<string, Json>, R extends string = string> {
  declare readonly id: string;
  declare readonly position: Position;
  declare readonly asker: Asker;
  declare cells: C;
  declare readonly house: HouseReach<R>;
  declare readonly standings: Standings;
  declare readonly occupants: Occupants;
  /** Her steward, asked as a standing, where she is not one. */
  declare readonly steward?: Untyped;
  /** The house's powers, where she is the steward. */
  declare readonly powers?: Powers;

  /**
   * A standing matched to a need; with none, a standing she reads first,
   * then asks by any ask its describe showed her.
   */
  declare held: (<X extends Need>(id: string, need: X) => Face<X, R>) & ((id: string) => Undeclared<R>);
  /**
   * A far house's public being, reached by its ward and its addresses and
   * asked as a stranger. Every ask is awaited, and signed with a key her
   * house keeps for that ward alone. With no need, she reads its describe
   * first, then asks by any ask it showed her.
   */
  declare stranger: (<X extends Need>(card: Card, need: X) => Face<X, R>) & ((card: Card) => Strange);
  /**
   * A handle to one of her asks. Each invitation it leaves as is spent within
   * `expires` milliseconds of leaving, or never binds.
   */
  declare handle: (ask: R, options?: { bind?: Json; notes?: Notes; once?: boolean; expires?: number }) => Handle;
  /** A new occupant, as a handle, with `expires` as `handle` has it. */
  declare invite: (id: string, options?: { notes?: Notes; expires?: number }) => Handle;
  /** Throws an error the asker can act on. */
  declare fail: (message: string) => never;

  /** A class, declared by one object. */
  static of<C extends Record<string, Json> = Record<string, never>, const N extends Record<string, Need> = Record<never, never>, const A extends Record<string, Entry> = Record<string, Entry>>(
    declaration: Declaration<C, N, A>,
  ): BeingClass<C, N, A> {
    // A class of her own, so the house reads her declaration from it.
    abstract class Declared extends Being<C, keyof A & string> {
      static readonly [DECLARATION] = declaration;
    }
    return Declared as unknown as BeingClass<C, N, A>;
  }
}

/** What `Being.of` gives: a class to extend. */
export type BeingClass<C, N, A> = (abstract new () => Being<C, keyof A & string> & { readonly [K in keyof N]: Face<N[K], keyof A & string> } & Typed<A>) & {
  readonly [DECLARATION]: Declaration<C, N, A>;
};

/** The members of `Being` a class may not name. */
export const MEMBERS: ReadonlySet<string> = new Set(['id', 'position', 'asker', 'cells', 'house', 'standings', 'occupants', 'steward', 'powers', 'held', 'stranger', 'handle', 'invite', 'fail']);

/** The declaration a class carries, or nothing where it is no class of `Being.of`. */
export const declarationOf = (value: unknown): Declaration | undefined => {
  if (typeof value !== 'function' || !(value.prototype instanceof Being)) return undefined;
  return (value as unknown as { [DECLARATION]?: Declaration })[DECLARATION];
};
