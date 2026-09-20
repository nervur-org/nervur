// SPDX-License-Identifier: Apache-2.0
// The standing's side of a relation: it seals asks and reads replies, and
// moves to its announced key and the following edge key when an object
// comes back to an ask above every ask it has moved on, and on nothing else.
//
// Its state is a value, so a ward keeps it in its partition.
import { encapsulate, hex, unhex } from '../crypto/index.ts';
import type { Invitation } from './invitation.ts';
import { Ephemeral, SigningKey, wardHalves, type Draw } from './keys.ts';
import { writePayload } from './payload.ts';
import { readReply, type Reply } from './reply.ts';
import { checkBody, follow, knockEdge, openReply, sealAsk, signBody, splitBody } from './seal.ts';

export type Read = Reply | { readonly nothing: true };

// A knock that brought no object back: its bytes, sent again as they are,
// and what the standing moves to if it bound.
type Knock = { readonly bytes: string; readonly lid: string; readonly next: string; readonly edge: string; readonly seq: number };

export type StandingState = {
  readonly key: string | null;
  readonly edge: string | null;
  readonly sent: number;
  readonly moved: number;
  readonly knock: Knock | null;
  // Whether the last ask after an unanswered knock asked under its own key,
  // so the next sends the knock again.
  readonly probed: boolean;
};

export const freshStanding = (): StandingState => ({ key: null, edge: null, sent: 0, moved: 0, knock: null, probed: false });

// One ask out: what `read` needs to read its reply and to move.
export type Sent = { readonly bytes: Uint8Array; readonly lid: Ephemeral; readonly next: string; readonly edge: string; readonly seq: number };

export class Standing {
  readonly invitation: Invitation;
  state: StandingState;
  readonly draw: Draw;

  constructor(invitation: Invitation, state: StandingState, draw: Draw) {
    this.invitation = invitation;
    this.state = state;
    this.draw = draw;
  }

  async ask(method?: string, args?: string): Promise<Sent | null> {
    const s = this.state;
    if (s.key !== null) return this.#ask(unhex(s.key), unhex(s.edge!), method, args);
    if (s.knock === null) return this.#knock(method, args);
    if (!s.probed) {
      this.state = { ...s, probed: true };
      return this.#ask(unhex(s.knock.next), unhex(s.knock.edge), method, args);
    }
    this.state = { ...s, probed: false };
    // The same bytes again: a new lid would be a new box.
    return { bytes: unhex(s.knock.bytes), lid: await Ephemeral.from(unhex(s.knock.lid)), next: s.knock.next, edge: s.knock.edge, seq: s.knock.seq };
  }

  async read(sent: Sent, bytes: Uint8Array | null): Promise<Read> {
    if (bytes === null) return { nothing: true };
    const reply = await this.#open(sent, bytes);
    if (reply === null) return { silence: true };
    if ('object' in reply.text && sent.seq > this.state.moved) {
      const edge = await follow(unhex(sent.edge), reply.agreement);
      this.state = { ...this.state, key: sent.next, edge: hex(edge), moved: sent.seq, knock: null, probed: false };
    }
    return reply.text;
  }

  async #knock(method?: string, args?: string): Promise<Sent | null> {
    const heir = await SigningKey.from(unhex(this.invitation.secret));
    const next = await SigningKey.draw(this.draw);
    const lid = await Ephemeral.draw(this.draw);
    const sent = encapsulate(unhex(this.invitation.lock), this.draw(32));
    if (sent === null) return null;
    const edge = await knockEdge(sent.shared);
    const seq = this.state.sent + 1;
    const body = await this.#body(heir, next, seq, method, args);
    const bytes = await sealAsk(lid, unhex(wardHalves(this.invitation.ward).padlock), unhex(this.invitation.heir), edge, body, sent.ciphertext);
    if (bytes === null) return null;
    this.state = { ...this.state, sent: seq, knock: { bytes: hex(bytes), lid: hex(lid.secret), next: hex(next.secret), edge: hex(edge), seq } };
    return { bytes, lid, next: hex(next.secret), edge: hex(edge), seq };
  }

  async #ask(secret: Uint8Array, edge: Uint8Array, method?: string, args?: string): Promise<Sent | null> {
    const by = await SigningKey.from(secret);
    const next = await SigningKey.draw(this.draw);
    const lid = await Ephemeral.draw(this.draw);
    const seq = this.state.sent + 1;
    const body = await this.#body(by, next, seq, method, args);
    const bytes = await sealAsk(lid, unhex(wardHalves(this.invitation.ward).padlock), unhex(this.invitation.heir), edge, body);
    if (bytes === null) return null;
    this.state = { ...this.state, sent: seq };
    return { bytes, lid, next: hex(next.secret), edge: hex(edge), seq };
  }

  #body(by: SigningKey, next: SigningKey, seq: number, method?: string, args?: string): Promise<Uint8Array> {
    const text = writePayload({ to: this.invitation.heir, by: by.id, next: next.id, seq, ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }) });
    return signBody(new TextEncoder().encode(text), by);
  }

  async #open(sent: Sent, bytes: Uint8Array): Promise<{ text: Reply; agreement: Uint8Array } | null> {
    const opened = await openReply(bytes, sent.lid);
    const body = opened && splitBody(opened.bytes);
    if (!opened || !body) return null;
    if (!(await checkBody(unhex(wardHalves(this.invitation.ward).signing), body))) return null;
    const text = readReply(body.text);
    return text && { text, agreement: opened.agreement };
  }
}
