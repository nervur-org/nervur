// SPDX-License-Identifier: Apache-2.0
// The door: an ask's box in, a reply's box out, judged by the thirteen cases
// of the spec in their order. A stranger hears one silence whatever the
// case. The case is handed back beside the bytes, for the kit's own eyes,
// with `heard`: whether a key the door holds or keeps spoke.
import { decapsulate, hex, unhex, utf8, x25519Public, zero } from '../crypto/index.ts';
import { drawLock, SigningKey, type Draw, type WardKey } from './keys.ts';
import type { Invitation } from './invitation.ts';
import { readPayload, type Payload } from './payload.ts';
import type { HeirRecord, Keys, Relations } from './relations.ts';
import { writeReply, type Reply } from './reply.ts';
import { checkBody, follow, HEAD, knockEdge, openBody, openHead, replyKey, sealReply, signBody, SIZE, splitBody, splitKnock, ZERO_EDGE, type OpenedHead, type ReplyKey } from './seal.ts';

// The count numbers below the highest a door still honours: those within
// this span that it has not seen.
export const SPAN = 64;

export type Choice = { readonly object: string; readonly seen: string | null } | { readonly silence: true };

// What stands behind the door. `zero` says whether anything answers the
// zero head.
export interface Behind {
  readonly zero: boolean;
  answer(heir: string | null, payload: Payload): Promise<Choice>;
}

export type Judged = { bytes: Uint8Array; case: number; heard: boolean };

type Body = { edge: Uint8Array; text: Uint8Array; signature: Uint8Array };

export class Door {
  readonly key: WardKey;
  readonly relations: Relations;
  readonly behind: Behind;
  readonly draw: Draw;

  constructor(key: WardKey, relations: Relations, behind: Behind, draw: Draw) {
    this.key = key;
    this.relations = relations;
    this.behind = behind;
    this.draw = draw;
  }

  // A new heir, held fresh, and its invitation. The lock is drawn at the
  // first invitation that names an heir, before the heir's secret.
  // A new heir, and its invitation, naming in `at` the addresses given.
  async invite(at: readonly string[] = []): Promise<{ heir: string; invitation: Invitation }> {
    let lock = this.relations.lock();
    if (!lock) this.relations.setLock((lock = drawLock(this.draw)));
    const heir = await SigningKey.draw(this.draw);
    this.relations.set(heir.id, { state: 'fresh' });
    const invitation = { ward: this.key.pk, heir: heir.id, secret: hex(heir.secret), lock: hex(lock.ek), ...(at.length > 0 ? { at: [...at] } : {}) };
    return { heir: heir.id, invitation };
  }

  // The door stops holding an heir. A fresh one leaves nothing, a spent one
  // leaves the keys kept at removal.
  remove(heir: string): boolean {
    const record = this.relations.get(heir);
    if (record === undefined || record.state === 'kept') return false;
    if (record.state === 'fresh') this.relations.delete(heir);
    else this.relations.set(heir, { state: 'kept', held: record.held, vouched: record.vouched, open: record.open, offered: record.offered });
    return true;
  }

  async arrive(bytes: Uint8Array): Promise<Judged> {
    const stranger = async (n: number): Promise<Judged> => ({ bytes: await this.#silence(bytes), case: n, heard: false });
    if (bytes.length > SIZE || bytes.length < HEAD) return stranger(1);
    const agreement = await this.key.open(bytes.subarray(0, HEAD));
    const opened = agreement && (await openHead(bytes, agreement));
    if (!opened) return stranger(1);
    const isZero = zero(opened.head);
    const heir = hex(opened.head);
    const record = isZero ? undefined : this.relations.get(heir);
    const body = await this.#body(opened, record);
    if (!body) return stranger(1);
    const read = readPayload(body.text);
    if ('fault' in read) return stranger(read.fault === 'not an object' ? 2 : 3);
    const p = read.payload;
    if (isZero ? p.to !== null : p.to !== heir) return stranger(3);

    if (isZero) {
      if (!this.behind.zero) return stranger(4);
      if (!(await checkBody(unhex(p.by), body))) return stranger(5);
      const choice = await this.#choose(null, p);
      return { bytes: await this.#sealed(opened, choice), case: 'object' in choice ? 12 : 13, heard: false };
    }

    if (record === undefined) return stranger(6);
    if (!admits(record, heir, p.by)) return stranger(7);
    if (!(await checkBody(unhex(p.by), body))) return stranger(8);
    const reply = await replyKey(this.draw, opened.lid);
    if (!reply) return stranger(1);
    const offered = await follow(body.edge, reply.agreement);

    // Checked again, since another arrival may have moved the keys while
    // this one was checking its signature.
    const now = this.relations.get(heir);
    if (now === undefined || !admits(now, heir, p.by) || !opensUnder(now, body.edge)) return stranger(7);
    if (now.state === 'kept') return this.#heard(reply, { quo: 'removed' }, 9);
    if (now.state === 'fresh' && (p.next === null || p.next === heir)) return this.#heard(reply, { quo: 'unannounced' }, 10);
    if (now.state === 'spent' && !honours(now, p.seq)) return this.#heard(reply, { quo: 'repeated' }, 11);

    this.relations.set(heir, move(now, heir, p, hex(body.edge), hex(offered)));
    const choice = await this.#choose(heir, p);
    const kept = await this.relations.kept().catch(() => false);
    return this.#heard(reply, kept ? choice : { silence: true }, kept && 'object' in choice ? 12 : 13);
  }

  async #heard(key: ReplyKey, reply: Reply, n: number): Promise<Judged> {
    return { bytes: await sealReply(key, await this.#signed(reply)), case: n, heard: true };
  }

  #signed(reply: Reply): Promise<Uint8Array> {
    return signBody(utf8(writeReply(reply)), this.key.signing);
  }

  async #choose(heir: string | null, p: Payload): Promise<Choice> {
    try {
      return await this.behind.answer(heir, p);
    } catch {
      return { silence: true };
    }
  }

  async #sealed(opened: OpenedHead, reply: Reply): Promise<Uint8Array> {
    const key = await replyKey(this.draw, opened.lid);
    return key ? sealReply(key, await this.#signed(reply)) : this.#silence(opened.lid);
  }

  // The body, opened under the edge keys the door takes for this head.
  async #body(opened: OpenedHead, record: HeirRecord | undefined): Promise<Body | null> {
    const tries: { edge: Uint8Array; sealed: Uint8Array }[] = [];
    if (record?.state === 'fresh') {
      const knock = splitKnock(opened.rest);
      const lock = this.relations.lock();
      const shared = knock && lock ? decapsulate(lock.dk, knock.ciphertext) : null;
      if (!knock || !shared) return null;
      tries.push({ edge: await knockEdge(shared), sealed: knock.sealedBody });
    } else if (record === undefined) tries.push({ edge: ZERO_EDGE, sealed: opened.rest });
    else for (const edge of [record.open, record.offered]) tries.push({ edge: unhex(edge), sealed: opened.rest });
    for (const { edge, sealed } of tries) {
      const plain = await openBody(opened, edge, sealed);
      if (plain === null) continue;
      const body = splitBody(plain);
      return body && { edge, ...body };
    }
    return null;
  }

  // A stranger's silence: sealed to the first thirty-two bytes that arrived
  // when they take a seal, and otherwise to a lid nobody holds.
  async #silence(arrived: Uint8Array): Promise<Uint8Array> {
    const text = await this.#signed({ silence: true });
    const candidates = [arrived.length >= HEAD ? arrived.subarray(0, HEAD) : null, this.draw(HEAD)];
    for (const lid of candidates) {
      const key = lid && (await replyKey(this.draw, lid));
      if (key) return sealReply(key, text);
    }
    return sealReply((await replyKey(this.draw, await x25519Public(this.draw(HEAD))))!, text);
  }
}

const admits = (record: HeirRecord, heir: string, by: string): boolean => (record.state === 'fresh' ? by === heir : by === record.held || by === record.vouched);

const opensUnder = (record: HeirRecord, edge: Uint8Array): boolean => record.state === 'fresh' || hex(edge) === record.open || hex(edge) === record.offered;

const honours = (record: { highest: number; honoured: readonly number[] }, seq: number): boolean =>
  seq > record.highest || (seq > record.highest - SPAN && seq !== record.highest && !record.honoured.includes(seq));

// The move tables: the keys and edge keys after a choice, and the count.
const move = (record: HeirRecord, heir: string, p: Payload, edge: string, offered: string): HeirRecord => {
  const announced = p.next !== null && p.next !== heir && p.next !== p.by ? p.next : null;
  if (record.state === 'fresh') return { state: 'spent', held: announced!, vouched: null, open: edge, offered, highest: p.seq, honoured: [] };
  if (record.state !== 'spent') return record;
  if (p.seq < record.highest) return { ...record, honoured: [...record.honoured, p.seq] };
  const keys: Keys = p.by === record.held ? { held: record.held, vouched: announced ?? record.vouched, open: edge, offered } : { held: p.by, vouched: announced, open: edge, offered };
  const honoured = [...record.honoured, record.highest].filter((n) => n > p.seq - SPAN);
  return { state: 'spent', ...keys, highest: p.seq, honoured };
};
