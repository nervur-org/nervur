// SPDX-License-Identifier: Apache-2.0
// The Quo room: one ward, sealing and counting as quo/SPEC.md writes. It
// keeps nothing. Every end of a relation is a record handed in and handed
// back moved, so whoever holds the room decides where the records live.
import type { Crypto, Keys, Tools } from '../foundation.ts';

const SIZE = 1_048_576;
const PK = 32;
const TAG = 16;
const SIG = 64;
const CIPHERTEXT = 1088;
const MAX_COUNT = 2 ** 53 - 1;
const COUNT = /^[1-9][0-9]*$/;
const PK_HEX = /^[0-9a-f]{64}$/;
const DIGEST = /^[0-9a-f]{16}$/;
const ZERO_PK = '0'.repeat(64);
const WORDS = new Set(['removed', 'unannounced', 'repeated']);

/** The invitation of the spec, read. */
export interface Invitation {
  readonly ward: string;
  readonly heir: string;
  readonly secret: string;
  readonly lock: string;
  readonly at?: readonly string[];
}

/** The door's end of a relation, by its heir. */
export interface Occupant {
  readonly heir: string;
  /** A door has made a choice on it. */
  readonly spent: boolean;
  /** The door stopped holding it while it was spent, and keeps its keys. */
  readonly removed: boolean;
  readonly held: string | null;
  readonly vouched: string | null;
  readonly open: string | null;
  readonly offered: string | null;
  /** The highest number honoured; the door honours none below it. */
  readonly highest: number;
}

/** The standing's end of a relation. */
export interface Standing {
  readonly invitation: Invitation;
  /** The secret it signs with. */
  readonly key: string;
  /** The edge key it sends under; `null` before its knock. */
  readonly edge: string | null;
  /** Its knock, kept to send again until the door is known to have bound it. */
  readonly knock: string | null;
  readonly bound: boolean;
  /** Whether its knock may have reached the door. Until it may have, the knock alone is sent again. */
  readonly heard: boolean;
  /** Whether the last box it sealed was its knock again. */
  readonly knockedLast: boolean;
  readonly sent: number;
  readonly moved: number;
}

/** One ask in flight, kept by its sender until its reply is read. */
export interface Pending {
  readonly seq: number;
  readonly lid: string;
  readonly announced: string | null;
  readonly under: string;
  readonly knock: boolean;
}

/** What a standing read. */
export type Read =
  | { readonly object: unknown; readonly text: string; readonly seen: string | null; readonly at?: readonly string[] }
  | { readonly silence: true }
  | { readonly quo: 'removed' | 'unannounced' | 'repeated' }
  | { readonly nothing: true };

/** What the door chooses. `object` is JSON text, written into the reply as it stands, and `at` where the ward is reached now. */
export type Choice = { readonly object: string; readonly seen: string | null; readonly at?: readonly string[] } | { readonly silence: true };

/** An ask the door admitted, waiting for its choice. */
export interface Admitted {
  readonly refused: false;
  /** `null` for the zero head. */
  readonly heir: string | null;
  readonly by: string;
  readonly seq: number;
  readonly method: string | undefined;
  /** The text of `args` as it arrived, `{}` where absent. */
  readonly args: string;
  /** Two keys of one name somewhere inside `args`. */
  readonly strange: boolean;
  /** The call id beside the method, a field Quo gives no meaning. */
  readonly call: string | undefined;
  /** The milliseconds its chain still has, a field Quo gives no meaning. */
  readonly within: number | undefined;
  /** The digest of the answer a watch holds, a field Quo gives no meaning. */
  readonly after: string | undefined;
  /** The ask's signature as hex, which names a box on the zero head. */
  readonly signature: string;
  /** The reply to the choice, and the occupant moved; `null` on the zero head. */
  choose(choice: Choice): Promise<{ readonly reply: Uint8Array; readonly occupant: Occupant | null }>;
}

/** A refusal: the reply, and nothing moves. `why` is the case, for the kit's own eyes. */
export interface Refusal {
  readonly refused: true;
  readonly reply: Uint8Array;
  readonly why: number;
}

export type Arrival = Admitted | Refusal;

/** How the door finds an occupant, and whether anything answers the zero head. */
export interface Lookup {
  occupant(heir: string): Promise<Occupant | undefined> | Occupant | undefined;
  readonly zero: boolean;
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

export class Room {
  readonly #keys: Keys;
  readonly #crypto: Crypto;
  readonly #tools: Tools;

  constructor(keys: Keys, crypto: Crypto, tools: Tools) {
    this.#keys = keys;
    this.#crypto = crypto;
    this.#tools = tools;
  }

  #hex(bytes: Uint8Array) {
    return this.#tools.hex(bytes);
  }

  #bytes(hex: string): Uint8Array {
    const bytes = this.#tools.bytes(hex);
    if (bytes === null) throw new TypeError('a record holds hex that is not hex');
    return bytes;
  }

  async #cipher(ikm: Uint8Array, label: string) {
    const out = await this.#crypto.hkdf(ikm, label, 44);
    return { key: out.subarray(0, 32), nonce: out.subarray(32) };
  }

  async #follow(edge: Uint8Array, agreement: Uint8Array) {
    return this.#crypto.hkdf(concat(edge, agreement), 'quo-edge', 32);
  }

  /** The ward's name: its signing pk, then its padlock, as 128 hex. */
  async ward(): Promise<string> {
    const ward = await this.#keys.ward();
    return this.#hex(concat(ward.signing, ward.padlock));
  }

  /** A new heir: the invitation to give away, and the occupant to keep. */
  async invite(at?: readonly string[]): Promise<{ invitation: Invitation; occupant: Occupant }> {
    const ward = await this.#keys.ward();
    const secret = this.#crypto.random(32);
    const heir = this.#hex(await this.#crypto.signingPublic(secret));
    const invitation: Invitation = {
      ward: this.#hex(concat(ward.signing, ward.padlock)),
      heir,
      secret: this.#hex(secret),
      lock: this.#hex(ward.lock),
      ...(at === undefined ? {} : { at: [...at] }),
    };
    return { invitation, occupant: { heir, spent: false, removed: false, held: null, vouched: null, open: null, offered: null, highest: 0 } };
  }

  /** The occupant after the door stops holding it: gone while fresh, its keys kept while spent. */
  release(occupant: Occupant): Occupant | null {
    return occupant.spent ? { ...occupant, removed: true } : null;
  }

  /** A value read as an invitation, or `null` where it is none. */
  async invitation(value: unknown): Promise<Invitation | null> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const { ward, heir, secret, lock, at } = value as Record<string, unknown>;
    const hex = (field: unknown, length: number) => typeof field === 'string' && field.length === length && this.#tools.bytes(field) !== null;
    if (!hex(ward, 128) || !hex(heir, 64) || !hex(secret, 64) || !hex(lock, 2368)) return null;
    if ((await this.#crypto.encapsulate(this.#bytes(lock as string))) === null) return null;
    const addresses = Array.isArray(at) ? at.filter((entry): entry is string => typeof entry === 'string') : undefined;
    return { ward: ward as string, heir: heir as string, secret: secret as string, lock: lock as string, ...(addresses === undefined ? {} : { at: addresses }) };
  }

  /** A standing on an invitation, before its knock. */
  standing(invitation: Invitation): Standing {
    return { invitation, key: invitation.secret, edge: null, knock: null, bound: false, heard: false, knockedLast: false, sent: 0, moved: 0 };
  }

  // ---- the door ----

  /** A box at the door: refused with its reply, or admitted and waiting for a choice. */
  async arrive(box: Uint8Array, lookup: Lookup): Promise<Arrival> {
    const refuse = async (why: number, lid: Uint8Array | null): Promise<Refusal> => ({ refused: true, reply: (await this.#reply(lid, '{"silence":true}')).box, why });
    const word = async (why: number, lid: Uint8Array, name: string): Promise<Refusal> => ({ refused: true, reply: (await this.#reply(lid, `{"quo":"${name}"}`)).box, why });

    const lid = box.length >= PK ? box.subarray(0, PK) : null;
    if (box.length > SIZE || lid === null) return refuse(1, lid);
    const agreement = await this.#keys.agree(lid);
    if (agreement === null) return refuse(1, lid);
    const headSeal = await this.#cipher(agreement, 'quo-seal');
    const head = await this.#crypto.open(headSeal.key, headSeal.nonce, box.subarray(PK, PK + PK + TAG), lid);
    if (head === null || head.length !== PK) return refuse(1, lid);

    const zero = head.every((byte) => byte === 0);
    const heir = zero ? null : this.#hex(head);
    const occupant = heir === null ? undefined : await lookup.occupant(heir);
    const fresh = occupant !== undefined && !occupant.spent;

    // The body, under each edge key the door takes for this head, in order.
    let rest = box.subarray(PK + PK + TAG);
    let edges: Uint8Array[];
    if (fresh) {
      if (rest.length < CIPHERTEXT) return refuse(1, lid);
      const shared = await this.#keys.decapsulate(rest.subarray(0, CIPHERTEXT));
      edges = [await this.#crypto.hkdf(shared, 'quo-lock', 32)];
      rest = rest.subarray(CIPHERTEXT);
    } else if (occupant === undefined) edges = [new Uint8Array(32)];
    else edges = [occupant.open, occupant.offered].filter((edge): edge is string => edge !== null).map((edge) => this.#bytes(edge));
    let body: Uint8Array | null = null;
    let under: Uint8Array | null = null;
    for (const edge of edges) {
      const seal = await this.#cipher(concat(agreement, edge), 'quo-edge-seal');
      body = await this.#crypto.open(seal.key, seal.nonce, rest, lid);
      if (body !== null) {
        under = edge;
        break;
      }
    }
    if (body === null || under === null || body.length <= SIG) return refuse(1, lid);

    const payloadBytes = body.subarray(0, body.length - SIG);
    const signature = body.subarray(body.length - SIG);
    const text = this.#tools.text(payloadBytes);
    const parsed = text === null ? null : this.#tools.parse(text);
    if (parsed === null || parsed.fields === null || parsed.duplicate) return refuse(2, lid);

    const payload = parsed.value as Record<string, unknown>;
    const fields = parsed.fields;
    const pk = (value: unknown) => typeof value === 'string' && PK_HEX.test(value) && value !== ZERO_PK;
    const seqText = fields.seq;
    const wellFormed =
      'to' in fields &&
      'by' in fields &&
      'next' in fields &&
      seqText !== undefined &&
      (zero ? payload.to === null : payload.to === heir) &&
      pk(payload.by) &&
      (payload.next === null || pk(payload.next)) &&
      COUNT.test(seqText) &&
      Number(seqText) <= MAX_COUNT &&
      (!('method' in fields) || typeof payload.method === 'string') &&
      (!('args' in fields) || (typeof payload.args === 'object' && payload.args !== null && !Array.isArray(payload.args)));
    if (!wellFormed) return refuse(3, lid);

    const by = payload.by as string;
    const next = payload.next as string | null;
    const seq = Number(seqText);
    const signedBy = this.#bytes(by);
    const admitted: Omit<Admitted, 'choose'> = {
      refused: false,
      heir,
      by,
      seq,
      method: payload.method as string | undefined,
      args: fields.args ?? '{}',
      strange: parsed.nestedDuplicate,
      call: typeof payload.call === 'string' ? payload.call : undefined,
      within: Number.isSafeInteger(payload.within) && (payload.within as number) >= 0 ? (payload.within as number) : undefined,
      after: typeof payload.after === 'string' && DIGEST.test(payload.after) ? payload.after : undefined,
      signature: this.#hex(signature),
    };

    if (zero) {
      if (!lookup.zero) return refuse(4, lid);
      if (!(await this.#crypto.verify(signedBy, payloadBytes, signature))) return refuse(5, lid);
      return { ...admitted, choose: async (choice) => ({ reply: (await this.#reply(lid, this.#write(choice))).box, occupant: null }) };
    }

    if (occupant === undefined || (occupant.removed && occupant.held === null)) return refuse(6, lid);
    const keys = fresh ? [occupant.heir] : [occupant.held, occupant.vouched].filter((key): key is string => key !== null);
    if (!keys.includes(by)) return refuse(7, lid);
    if (!(await this.#crypto.verify(signedBy, payloadBytes, signature))) return refuse(8, lid);
    if (occupant.removed) return word(9, lid, 'removed');
    const announced = next === null || next === occupant.heir || next === by ? null : next;
    if (fresh && announced === null) return word(10, lid, 'unannounced');
    if (!fresh && seq <= occupant.highest) return word(11, lid, 'repeated');

    return {
      ...admitted,
      choose: async (choice) => {
        const { box: reply, agreement: replied } = await this.#reply(lid, this.#write(choice));
        const offered = this.#hex(await this.#follow(under, replied));
        const open = this.#hex(under);
        const moved: Occupant = fresh
          ? { ...occupant, spent: true, held: announced, vouched: null, open, offered, highest: seq }
          : { ...occupant, held: by, vouched: announced ?? (by === occupant.held ? occupant.vouched : null), open, offered, highest: seq };
        return { reply, occupant: moved };
      },
    };
  }

  #write(choice: Choice): string {
    if ('silence' in choice) return '{"silence":true}';
    const at = choice.at === undefined ? '' : `,"at":${JSON.stringify(choice.at)}`;
    return `{"object":${choice.object},"seen":${JSON.stringify(choice.seen)}${at}}`;
  }

  // A reply sealed to a lid, or to a lid nobody holds where the lid takes no seal.
  async #reply(lid: Uint8Array | null, text: string): Promise<{ box: Uint8Array; agreement: Uint8Array }> {
    const secret = this.#crypto.random(32);
    const pk = await this.#crypto.agreePublic(secret);
    let to = lid;
    let agreement = to === null ? null : await this.#crypto.agree(secret, to);
    if (agreement === null) {
      to = this.#crypto.random(32);
      agreement = await this.#crypto.agree(secret, to);
      if (agreement === null) {
        to = await this.#crypto.agreePublic(this.#crypto.random(32));
        agreement = (await this.#crypto.agree(secret, to))!;
      }
    }
    const textBytes = this.#tools.utf8(text);
    const signature = await this.#keys.sign(concat(to!, textBytes));
    const seal = await this.#cipher(agreement, 'quo-seal');
    const sealed = await this.#crypto.seal(seal.key, seal.nonce, concat(textBytes, signature), pk);
    return { box: concat(pk, sealed), agreement };
  }

  // ---- the standing ----

  /** The next box on a relation: its knock, its knock again, or an ask. */
  async seal(standing: Standing, ask: { method?: string; args?: string; call?: string; within?: number; after?: string }): Promise<{ box: Uint8Array; pending: Pending; standing: Standing }> {
    const invitation = standing.invitation;
    const ward = this.#bytes(invitation.ward);
    const padlock = ward.subarray(32);

    // A knock no door heard binds nothing, so it goes again alone. After one
    // that may have been heard and brought no object back, the knock again
    // and an ask under its own key take turns, until the door is known to
    // have bound it.
    if (standing.knock !== null && !standing.bound && (!standing.heard || (!standing.knockedLast && standing.sent > 1))) {
      const kept = JSON.parse(standing.knock) as { box: string; pending: Pending };
      return { box: this.#bytes(kept.box), pending: kept.pending, standing: { ...standing, knockedLast: true } };
    }

    const knock = standing.edge === null;
    const seq = standing.sent + 1;
    const nextSecret = this.#crypto.random(32);
    const next = this.#hex(await this.#crypto.signingPublic(nextSecret));
    const signing = this.#bytes(standing.key);
    const by = this.#hex(await this.#crypto.signingPublic(signing));
    const payload = `{"to":"${invitation.heir}","by":"${by}","next":"${next}","seq":${seq}${ask.method === undefined ? '' : `,"method":${JSON.stringify(ask.method)}`}${ask.args === undefined ? '' : `,"args":${ask.args}`}${ask.call === undefined ? '' : `,"call":${JSON.stringify(ask.call)}`}${ask.within === undefined ? '' : `,"within":${ask.within}`}${ask.after === undefined ? '' : `,"after":"${ask.after}"`}}`;
    const payloadBytes = this.#tools.utf8(payload);
    const signature = await this.#crypto.sign(signing, payloadBytes);

    const lidSecret = this.#crypto.random(32);
    const lid = await this.#crypto.agreePublic(lidSecret);
    const agreement = await this.#crypto.agree(lidSecret, padlock);
    if (agreement === null) throw new TypeError('the ward’s padlock takes no seal');
    const headSeal = await this.#cipher(agreement, 'quo-seal');
    const head = await this.#crypto.seal(headSeal.key, headSeal.nonce, this.#bytes(invitation.heir), lid);

    let edge: Uint8Array;
    let ciphertext: Uint8Array = new Uint8Array(0);
    if (knock) {
      const encapsulated = await this.#crypto.encapsulate(this.#bytes(invitation.lock));
      if (encapsulated === null) throw new TypeError('the invitation’s lock is refused');
      ciphertext = encapsulated.ciphertext;
      edge = await this.#crypto.hkdf(encapsulated.shared, 'quo-lock', 32);
    } else edge = this.#bytes(standing.edge);
    const bodySeal = await this.#cipher(concat(agreement, edge), 'quo-edge-seal');
    const body = await this.#crypto.seal(bodySeal.key, bodySeal.nonce, concat(payloadBytes, signature), lid);
    const box = concat(lid, head, ciphertext, body);

    const pending: Pending = { seq, lid: this.#hex(lidSecret), announced: this.#hex(nextSecret), under: this.#hex(edge), knock };
    // A knock is the one ask after which the door admits one key: the one it
    // announces, under the knock's edge key. The standing asks under both.
    const moved: Standing = knock
      ? { ...standing, key: this.#hex(nextSecret), edge: this.#hex(edge), knock: JSON.stringify({ box: this.#hex(box), pending }), sent: seq, knockedLast: false }
      : { ...standing, sent: seq, knockedLast: false };
    return { box, pending, standing: moved };
  }

  /** A reply read, and the standing moved where an object came back above every ask it moved on. */
  /** `heard` says whether a box that brought nothing may have reached the door; a reply was heard. */
  async read(given: Standing, pending: Pending, reply: Uint8Array | null, heard = true): Promise<{ read: Read; standing: Standing }> {
    const standing = pending.knock && (reply !== null || heard) ? { ...given, heard: true } : given;
    const { read, agreement } = await this.#reading(standing.invitation.ward, pending.lid, reply);
    if ('quo' in read) {
      // A word is said only to an admitted key, so the door holds the relation.
      return { read, standing: { ...standing, bound: pending.knock ? standing.bound : true } };
    }
    if (!('object' in read)) return { read, standing };
    if (pending.seq <= standing.moved) return { read, standing: { ...standing, bound: true } };
    const edge = this.#hex(await this.#follow(this.#bytes(pending.under), agreement!));
    return { read, standing: { ...standing, key: pending.announced ?? standing.key, edge, moved: pending.seq, bound: true, knock: null } };
  }

  // A reply opened under the lid's secret and held to the ward's signature.
  async #reading(ward: string, lidHex: string, reply: Uint8Array | null): Promise<{ read: Read; agreement: Uint8Array | null }> {
    if (reply === null) return { read: { nothing: true }, agreement: null };
    const silence = { read: { silence: true as const }, agreement: null };
    if (reply.length > SIZE || reply.length < PK + TAG + SIG) return silence;
    const pk = reply.subarray(0, PK);
    const lidSecret = this.#bytes(lidHex);
    const agreement = await this.#crypto.agree(lidSecret, pk);
    if (agreement === null) return silence;
    const seal = await this.#cipher(agreement, 'quo-seal');
    const body = await this.#crypto.open(seal.key, seal.nonce, reply.subarray(PK), pk);
    if (body === null || body.length < SIG) return silence;
    const textBytes = body.subarray(0, body.length - SIG);
    const lid = await this.#crypto.agreePublic(lidSecret);
    const signing = this.#bytes(ward).subarray(0, 32);
    if (!(await this.#crypto.verify(signing, concat(lid, textBytes), body.subarray(body.length - SIG)))) return silence;
    const text = this.#tools.text(textBytes);
    const parsed = text === null ? null : this.#tools.parse(text);
    if (parsed === null || parsed.fields === null || parsed.duplicate) return silence;
    const value = parsed.value as Record<string, unknown>;
    const keys = Object.keys(parsed.fields);
    const only = (...names: string[]) => keys.length === names.length && names.every((name) => keys.includes(name));
    if (only('silence') && value.silence === true) return silence;
    if (only('quo') && typeof value.quo === 'string' && WORDS.has(value.quo)) return { read: { quo: value.quo as 'removed' }, agreement };
    if ((only('object', 'seen') || only('object', 'seen', 'at')) && (value.seen === null || typeof value.seen === 'string')) {
      // An `at` is read as an invitation's is: no array reads as absent, and an entry that is no string is skipped.
      const at = Array.isArray(value.at) ? value.at.filter((entry): entry is string => typeof entry === 'string') : undefined;
      return { read: { object: value.object, text: parsed.fields.object, seen: value.seen, ...(at === undefined ? {} : { at }) }, agreement };
    }
    return silence;
  }

  // ---- a stranger ----

  /** An ask on the zero head of a ward, signed by `secret`, which the door keeps nothing of. */
  async stranger(ward: string, secret: string, ask: { method?: string; args?: string }): Promise<{ box: Uint8Array; lid: string }> {
    const padlock = this.#bytes(ward).subarray(32);
    const signing = this.#bytes(secret);
    const by = this.#hex(await this.#crypto.signingPublic(signing));
    const payload = `{"to":null,"by":"${by}","next":null,"seq":1${ask.method === undefined ? '' : `,"method":${JSON.stringify(ask.method)}`}${ask.args === undefined ? '' : `,"args":${ask.args}`}}`;
    const payloadBytes = this.#tools.utf8(payload);
    const signature = await this.#crypto.sign(signing, payloadBytes);
    const lidSecret = this.#crypto.random(32);
    const lid = await this.#crypto.agreePublic(lidSecret);
    const agreement = await this.#crypto.agree(lidSecret, padlock);
    if (agreement === null) throw new TypeError('the ward’s padlock takes no seal');
    const headSeal = await this.#cipher(agreement, 'quo-seal');
    const head = await this.#crypto.seal(headSeal.key, headSeal.nonce, new Uint8Array(32), lid);
    const bodySeal = await this.#cipher(concat(agreement, new Uint8Array(32)), 'quo-edge-seal');
    const body = await this.#crypto.seal(bodySeal.key, bodySeal.nonce, concat(payloadBytes, signature), lid);
    return { box: concat(lid, head, body), lid: this.#hex(lidSecret) };
  }

  /** A stranger's reply read. */
  async strangerRead(ward: string, lid: string, reply: Uint8Array | null): Promise<Read> {
    return (await this.#reading(ward, lid, reply)).read;
  }
}
