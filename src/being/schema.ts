// SPDX-License-Identifier: Apache-2.0
// The schema builder. Each call writes JSON Schema 2020-12 in the closed
// subset the house checks, and carries the TypeScript type beside it.

declare const TYPE: unique symbol;

/** A schema in the closed subset, typed by what it admits. */
export type Schema<T = unknown> = { readonly [key: string]: unknown } & { readonly [TYPE]?: T };

/** The type a schema admits. */
export type Infer<S> = S extends { readonly [TYPE]?: infer T } ? T : never;

/** A relation crossing: a handle on the way out, a standing id on the way in. */
export interface HandleMark {
  readonly handleMark: true;
}

/** An invitation carried unopened. It is an object and never a value. */
export interface Invitation {
  readonly invitation: true;
}

/** A reference to one of her asks, or to an occupant she minted. */
export interface Handle {
  readonly id: string;
}

type Mapped<T, H> = T extends HandleMark
  ? H
  : T extends Invitation
    ? // A handle under s.invitation leaves as an invitation too.
      Invitation | (H extends Handle ? Handle : never)
    : T extends Uint8Array
      ? T
      : T extends readonly (infer E)[]
        ? Mapped<E, H>[]
        : T extends object
          ? { [K in keyof T]: Mapped<T[K], H> }
          : T;

/** What a method receives: a handle has arrived as a standing id. */
export type Inbound<T> = Mapped<T, string>;
/** What a call sends: a handle leaves as a handle, or as an invitation she carries, for its receiver to take. */
export type Outbound<T> = Mapped<T, Handle | Invitation>;

export const HANDLE_MEDIA = 'application/vnd.nervur.handle';
export const INVITATION_MEDIA = 'application/vnd.nervur.invitation';

/** The keywords the house checks, and no other. */
export const KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'enum',
  'const',
  'items',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'pattern',
  'anyOf',
  'contentEncoding',
  'contentMediaType',
]);

const TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

const OPTIONAL: unique symbol = Symbol('optional');
type Optional<S extends Schema> = S & { readonly [OPTIONAL]: true };

type Flat<T> = { [K in keyof T]: T[K] } & {};
type Props = Record<string, Schema>;
type OptionalKeys<P extends Props> = { [K in keyof P]: P[K] extends { readonly [OPTIONAL]: true } ? K : never }[keyof P];
type ObjectOf<P extends Props> = Flat<
  { -readonly [K in Exclude<keyof P, OptionalKeys<P>>]: Infer<P[K]> } & { -readonly [K in OptionalKeys<P>]?: Infer<P[K]> }
>;

/** A method of a need, as `s.reply` reads it. */
export interface MethodRef<R = unknown> {
  readonly args?: Schema;
  readonly result?: Schema<R>;
}

/** The args of a reply: the method's result, or its error. */
export type Reply<R> = { result: R; error?: undefined } | { error: { message: string }; result?: undefined };

type Bounds = { minimum?: number; maximum?: number };
type Lengths = { minLength?: number; maxLength?: number };

const frozen = <T>(schema: object): Schema<T> => Object.freeze(schema) as Schema<T>;

const bounded = (schema: object, bounds: object = {}) => {
  for (const [key, value] of Object.entries(bounds)) if (value !== undefined) Object.assign(schema, { [key]: value });
  return schema;
};

type Scalar = string | number | boolean | null;

export const s = Object.freeze({
  object: <P extends Props>(properties: P): Schema<ObjectOf<P>> => {
    const required = Object.keys(properties).filter((key) => !(OPTIONAL in properties[key]));
    const plain = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, strip(value)]));
    return frozen({ type: 'object', properties: Object.freeze(plain), required: Object.freeze(required), additionalProperties: false });
  },
  string: (lengths?: Lengths & { pattern?: string }): Schema<string> => frozen(bounded({ type: 'string' }, lengths)),
  number: (bounds?: Bounds): Schema<number> => frozen(bounded({ type: 'number' }, bounds)),
  integer: (bounds?: Bounds): Schema<number> => frozen(bounded({ type: 'integer' }, bounds)),
  boolean: (): Schema<boolean> => frozen({ type: 'boolean' }),
  array: <S extends Schema>(items: S): Schema<Infer<S>[]> => frozen({ type: 'array', items: strip(items) }),
  enum: <const V extends readonly Scalar[]>(values: V): Schema<V[number]> => frozen({ enum: Object.freeze([...values]) }),
  const: <const V extends Scalar>(value: V): Schema<V> => frozen({ const: value }),
  // Lengths count bytes, and the schema counts their hex, two digits a byte.
  bytes: (lengths?: Lengths): Schema<Uint8Array> =>
    frozen(
      bounded(
        { type: 'string', contentEncoding: 'base16' },
        { minLength: lengths?.minLength === undefined ? undefined : lengths.minLength * 2, maxLength: lengths?.maxLength === undefined ? undefined : lengths.maxLength * 2 },
      ),
    ),
  optional: <S extends Schema>(schema: S): Optional<S> => Object.freeze({ ...schema, [OPTIONAL]: true }) as Optional<S>,
  handle: (): Schema<HandleMark> => frozen({ type: 'string', contentEncoding: 'base16', contentMediaType: HANDLE_MEDIA }),
  invitation: (): Schema<Invitation> => frozen({ type: 'string', contentEncoding: 'base16', contentMediaType: INVITATION_MEDIA }),
  reply: <R>(method: MethodRef<R>): Schema<Reply<unknown extends R ? null : R>> =>
    frozen({
      anyOf: Object.freeze([
        s.object({ result: method.result ?? s.const(null) }),
        s.object({ error: s.object({ message: s.string() }) }),
      ]),
    }),
});

const strip = (schema: Schema): Schema => {
  if (!(OPTIONAL in schema)) return schema;
  const { [OPTIONAL]: _mark, ...plain } = schema as Optional<Schema>;
  return frozen(plain);
};

/**
 * Every way a schema leaves the subset, each as a sentence naming where.
 * The empty list is a schema the house checks.
 */
export const outside = (schema: unknown, at = 'the schema'): string[] => {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return [`${at} is not a schema object`];
  const found: string[] = [];
  const node = schema as Record<string, unknown>;
  for (const key of Object.keys(node)) if (!KEYWORDS.has(key)) found.push(`${at} names ${key}, outside the subset`);
  const type = node.type;
  if (type !== undefined && !(typeof type === 'string' && TYPES.has(type))) found.push(`${at} has a type the subset does not name`);
  if (node.contentEncoding !== undefined && node.contentEncoding !== 'base16') found.push(`${at} has a contentEncoding other than base16`);
  const media = node.contentMediaType;
  if (media !== undefined && media !== HANDLE_MEDIA && media !== INVITATION_MEDIA) found.push(`${at} has a contentMediaType that is not a mark`);
  if (media !== undefined && node.contentEncoding !== 'base16') found.push(`${at} marks a relation that is not base16`);
  for (const key of ['minLength', 'maxLength'] as const) {
    const value = node[key];
    if (value !== undefined && !(Number.isInteger(value) && (value as number) >= 0)) found.push(`${at} has a ${key} that is not a count`);
  }
  for (const key of ['minimum', 'maximum'] as const) {
    if (node[key] !== undefined && !Number.isFinite(node[key])) found.push(`${at} has a ${key} that is not a number`);
  }
  if (node.pattern !== undefined) found.push(...pattern(node.pattern, at));
  if (node.properties !== undefined) {
    if (typeof node.properties !== 'object' || node.properties === null || Array.isArray(node.properties)) found.push(`${at} has properties that are not an object`);
    else for (const [key, value] of Object.entries(node.properties)) found.push(...outside(value, `${at}.${key}`));
  }
  if (node.required !== undefined && !(Array.isArray(node.required) && node.required.every((key) => typeof key === 'string'))) found.push(`${at} has required that is not a list of names`);
  if (node.additionalProperties !== undefined && typeof node.additionalProperties !== 'boolean') found.push(`${at} has additionalProperties that is not true or false`);
  if (node.enum !== undefined && !(Array.isArray(node.enum) && node.enum.every(scalar))) found.push(`${at} has an enum that is not a list of scalars`);
  if ('const' in node && !scalar(node.const)) found.push(`${at} has a const that is not a scalar`);
  if (node.items !== undefined) found.push(...outside(node.items, `${at}[]`));
  if (node.anyOf !== undefined) {
    if (!Array.isArray(node.anyOf) || node.anyOf.length === 0) found.push(`${at} has an anyOf that is not a list of schemas`);
    else node.anyOf.forEach((branch, index) => found.push(...outside(branch, `${at}|${index}`)));
  }
  return found;
};

const scalar = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value);

const pattern = (value: unknown, at: string): string[] => {
  if (typeof value !== 'string') return [`${at} has a pattern that is not a string`];
  try {
    return RegExp(value, 'u').unicode ? [] : [`${at} has a pattern that is not unicode`];
  } catch {
    return [`${at} has a pattern that does not compile`];
  }
};
