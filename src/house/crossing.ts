// SPDX-License-Identifier: Apache-2.0
// What crosses between a being and the wire. A handle, an invitation
// carried unopened and bytes are objects in her hands and hex on the wire.
// The schema says where each stands.
import { HANDLE_MEDIA, INVITATION_MEDIA } from '../being/schema.ts';
import type { Tools } from '../foundation.ts';

type Node = Readonly<Record<string, unknown>>;

/** Where a handle points, and who may pass it on. */
export interface Pointed {
  readonly being: string;
  readonly occupant: string;
  readonly holder: string;
  /** How long each invitation minted from it may wait unspent, in milliseconds. */
  readonly expires?: number;
}

/** A reference to an occupant: one of her own, or one her steward minted on another being. It is no value. */
export class HandleRef {
  readonly id: string;
  constructor(occupant: string) {
    this.id = occupant;
    Object.freeze(this);
  }
}

/** An invitation carried unopened. It is no value. */
export class Carried {
  readonly invitation = true;
  constructor() {
    Object.freeze(this);
  }

  toJSON(): never {
    throw new Crossing('an invitation carried unopened is no value');
  }
}

/**
 * One house's marks on the objects it hands its beings: where each handle
 * points, and the bytes of each invitation carried. An object another
 * house marked is no handle and no invitation here.
 */
export class Marks {
  readonly #minted = new WeakMap<object, Pointed>();
  readonly #carried = new WeakMap<object, string>();

  handle(being: string, occupant: string, holder: string = being, expires?: number): HandleRef {
    const handle = new HandleRef(occupant);
    this.#minted.set(handle, { being, occupant, holder, ...(expires === undefined ? {} : { expires }) });
    return handle;
  }

  carried(hex: string): Carried {
    const invitation = new Carried();
    this.#carried.set(invitation, hex);
    return invitation;
  }

  /** Where a handle points, where it is one of this house's. */
  handleOf(value: unknown): Pointed | undefined {
    return typeof value === 'object' && value !== null ? this.#minted.get(value) : undefined;
  }

  /** An invitation's bytes, where it is one this house carries. */
  hexOf(value: unknown): string | undefined {
    return typeof value === 'object' && value !== null ? this.#carried.get(value) : undefined;
  }
}

/** A failure of a crossing, with the message the caller reads. */
export class Crossing extends Error {}

const branchFits = (tools: Tools, branch: Node, value: unknown) => tools.check(branch, value) === null;

/**
 * Her value made wire JSON. `mint` turns a handle she holds into the hex its
 * receiver can call. `owner` is her id: a handle she does not hold is refused.
 * A handle under `s.invitation` leaves as an invitation, as one carried does.
 * An invitation carried under `s.handle` leaves as itself, for its receiver
 * to take. `redeem` turns a carried invitation this house minted into what
 * its reader calls, where the reader is a faculty: a token for its occupant.
 */
export const outward = async (
  tools: Tools,
  marks: Marks,
  schema: Node | undefined,
  value: unknown,
  owner: string,
  mint: (handle: Pointed) => Promise<string>,
  redeem: (hex: string) => Promise<string | undefined> = () => Promise.resolve(undefined),
): Promise<unknown> => {
  const held = (at: unknown) => {
    const handle = marks.handleOf(at);
    return handle !== undefined && handle.holder === owner ? handle : undefined;
  };
  const walk = async (node: Node | undefined, at: unknown): Promise<unknown> => {
    if (node === undefined) return at;
    if (node.contentMediaType === HANDLE_MEDIA) {
      const handle = held(at);
      if (handle !== undefined) return mint(handle);
      // An invitation carried unopened is handed on, and its receiver takes it.
      const hex = marks.hexOf(at);
      if (hex === undefined) throw new Crossing('a handle is owed where a value stands');
      return (await redeem(hex)) ?? hex;
    }
    if (node.contentMediaType === INVITATION_MEDIA) {
      const handle = held(at);
      if (handle !== undefined) return mint(handle);
      const hex = marks.hexOf(at);
      if (hex === undefined) throw new Crossing('an invitation is owed where a value stands');
      return (await redeem(hex)) ?? hex;
    }
    if (node.contentEncoding === 'base16' && at instanceof Uint8Array) return tools.hex(at);
    if (Array.isArray(node.anyOf)) {
      for (const branch of node.anyOf as Node[]) {
        try {
          const out = await walk(branch, at);
          if (branchFits(tools, branch, out)) return out;
        } catch (error) {
          if (!(error instanceof Crossing)) throw error;
        }
      }
      return at;
    }
    if (Array.isArray(at) && node.items !== undefined) return Promise.all(at.map((item) => walk(node.items as Node, item)));
    if (typeof at === 'object' && at !== null && !Array.isArray(at) && !(at instanceof Uint8Array) && node.properties !== undefined) {
      const properties = node.properties as Record<string, Node>;
      const out: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(at)) {
        if (field === undefined) continue;
        out[key] = await walk(Object.hasOwn(properties, key) ? properties[key] : undefined, field);
      }
      return out;
    }
    return at;
  };
  const out = await walk(schema, value);
  const why = schema === undefined ? null : tools.check(schema, out);
  if (why !== null) throw new Crossing(why);
  return out;
};

/** Wire JSON made her value. `accept` turns an invitation's hex into a standing id. */
export const inward = async (tools: Tools, marks: Marks, schema: Node | undefined, value: unknown, accept: (hex: string) => Promise<string>): Promise<unknown> => {
  const walk = async (node: Node | undefined, at: unknown): Promise<unknown> => {
    if (node === undefined) return at;
    if (node.contentMediaType === HANDLE_MEDIA) return accept(at as string);
    if (node.contentMediaType === INVITATION_MEDIA) return marks.carried(at as string);
    if (node.contentEncoding === 'base16') return tools.bytes(at as string);
    if (Array.isArray(node.anyOf)) {
      const branch = (node.anyOf as Node[]).find((option) => branchFits(tools, option, at));
      return walk(branch, at);
    }
    if (Array.isArray(at) && node.items !== undefined) return Promise.all(at.map((item) => walk(node.items as Node, item)));
    if (typeof at === 'object' && at !== null && !Array.isArray(at) && node.properties !== undefined) {
      const properties = node.properties as Record<string, Node>;
      const out: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(at)) out[key] = await walk(Object.hasOwn(properties, key) ? properties[key] : undefined, field);
      return out;
    }
    return at;
  };
  return walk(schema, value);
};
