// SPDX-License-Identifier: Apache-2.0
// The foundation: the references the house calls, each a contract every
// ground fills. The house holds them and hands none to a being.

/** The ward's public keys, as the house writes them into an invitation. */
export interface WardKeys {
  /** The Ed25519 signing pk. */
  readonly signing: Uint8Array;
  /** The X25519 padlock. */
  readonly padlock: Uint8Array;
  /** The ML-KEM-768 lock's encapsulation key, 1184 bytes. */
  readonly lock: Uint8Array;
}

/** Operations over the ward's secret. The secret never leaves. */
export interface Keys {
  ward(): Promise<WardKeys>;
  /** Ed25519 by the ward's signing key. */
  sign(message: Uint8Array): Promise<Uint8Array>;
  /** X25519 of the ward's scalar with `pk`; `null` where `pk` takes no seal. */
  agree(pk: Uint8Array): Promise<Uint8Array | null>;
  /** ML-KEM-768 decapsulation with the ward's lock. */
  decapsulate(ciphertext: Uint8Array): Promise<Uint8Array>;
  /** Thirty-two or more bytes the house derives for its own use, by a label that is not Quo's. */
  derive(label: string, length: number): Promise<Uint8Array>;
}

/** The algorithms Quo names, and randomness. */
export interface Crypto {
  random(length: number): Uint8Array;
  sha256(data: Uint8Array): Promise<Uint8Array>;
  /** HKDF-SHA-256 with the zero-length salt, `info` as ASCII. */
  hkdf(ikm: Uint8Array, info: string, length: number): Promise<Uint8Array>;
  /** AES-256-GCM, the tag at the end. */
  seal(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, additional: Uint8Array): Promise<Uint8Array>;
  /** AES-256-GCM opened, or `null` where it does not open. */
  open(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, additional: Uint8Array): Promise<Uint8Array | null>;
  signingPublic(secret: Uint8Array): Promise<Uint8Array>;
  sign(secret: Uint8Array, message: Uint8Array): Promise<Uint8Array>;
  /** Ed25519 checked as Quo checks it: cofactorless, strict, and no small-order key. */
  verify(pk: Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean>;
  agreePublic(secret: Uint8Array): Promise<Uint8Array>;
  /** X25519, or `null` where the agreement is all zero. */
  agree(secret: Uint8Array, pk: Uint8Array): Promise<Uint8Array | null>;
  /** An ML-KEM-768 pair from sixty-four bytes, as KeyGen_internal(d, z) takes them. */
  lockPair(seed: Uint8Array): Promise<{ encapsulation: Uint8Array; decapsulation: Uint8Array }>;
  /** ML-KEM-768 encapsulation, or `null` where the modulus check refuses the key. */
  encapsulate(encapsulation: Uint8Array): Promise<{ ciphertext: Uint8Array; shared: Uint8Array } | null>;
  decapsulate(decapsulation: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array>;
}

/** A JSON text read strictly. */
export interface Parsed {
  readonly value: unknown;
  /** The text of each own key's value, where the value is an object. */
  readonly fields: Readonly<Record<string, string>> | null;
  /** Two own keys of one name. */
  readonly duplicate: boolean;
  /** Two keys of one name in some object inside. */
  readonly nestedDuplicate: boolean;
}

/** Text, bytes and JSON, each read strictly. */
export interface Tools {
  utf8(text: string): Uint8Array;
  /** UTF-8 read fatally, or `null`; a byte order mark is kept and is no whitespace. */
  text(bytes: Uint8Array): string | null;
  hex(bytes: Uint8Array): string;
  /** Lowercase hex read, or `null`. */
  bytes(hex: string): Uint8Array | null;
  /** RFC 8259 read, or `null` where the text is no JSON. */
  parse(text: string): Parsed | null;
  /** One spelling of a JSON value: keys sorted, no whitespace. */
  canonical(value: unknown): string;
  /** A JSON value held to a schema of the closed subset: `null` where it holds, or why not. */
  check(schema: unknown, value: unknown): string | null;
}

/** A place read: its entries by name, and its version; `null` where the place is absent. */
export interface PlaceRead {
  readonly entries: Readonly<Record<string, Uint8Array>>;
  readonly version: string | null;
}

/** Sealed entries by name, in places. */
export interface Memory {
  read(options: { place: string }): Promise<PlaceRead>;
  list(): Promise<readonly string[]>;
  /**
   * Lands every place it names together, or none. An entry of `null` is
   * removed. `expect` names the versions read, `null` for a place read absent.
   * It answers each written place's new version, `null` where the place is
   * gone, or `null` whole where the versions moved and nothing landed.
   */
  write(options: {
    writes: Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
    expect: Readonly<Record<string, string | null>>;
  }): Promise<Readonly<Record<string, string | null>> | null>;
}

/** A class of `Being.of`, as `classes` answers one. */
export type BeingClass = abstract new () => object;

/** The code of each kind, from one source. */
export interface Classes {
  resolve(options: { kind: string }): Promise<BeingClass | undefined>;
  /** The steward's kind. */
  steward(): string;
  /** The public being's kind, where there is one. */
  public(): string | undefined;
}

/** Boxes to far wards, and the addresses the house writes into an invitation. */
export interface Carry {
  /**
   * The box handed to the door of a ward this carry listens for, before any
   * address. Otherwise it is carried to the first of `at` that answers, in
   * order. A box that may have been heard is carried to no second address.
   * `wait` is how long this box may wait for its reply, in milliseconds,
   * in place of the carry's own; a watch held long is not cut short.
   */
  send(options: { ward: string; at: readonly string[]; box: Uint8Array; wait?: number }): Promise<Sent>;
  at(options: { toward?: string }): readonly string[];
  /**
   * The domains that vouch for the ward, as quo/DOMAIN.md writes a vouch:
   * each domain its addresses in `at` name, asked in their order. A carry
   * that speaks no web names none, and answers nothing it did not read.
   */
  vouched(options: { ward: string; at: readonly string[] }): Promise<readonly string[]>;
}

/**
 * What a send came to: the reply and the address that gave it, or nothing.
 * A reply from a door the carry holds names no address. Nothing says
 * whether the box may have been heard. A box surely unheard may go to
 * another address; one that may have been heard may not.
 */
export type Sent = { readonly reply: Uint8Array; readonly via?: string } | { readonly reply: null; readonly heard: boolean };

/** The time, and one wait per id. */
export interface Clock {
  now(): number;
  /** `true` once `ms` has passed; `false` where it was cancelled or replaced. */
  wait(options: { id: string; ms: number }): Promise<boolean>;
  cancel(options: { id: string }): void;
}
