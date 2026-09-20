// SPDX-License-Identifier: Apache-2.0
// The stand of `quo/vectors/HARNESS.md`, over `quo/`, `nervur/tcp` and
// `nervur/http`: part one judged, and part two carried, its wards
// answering on one tcp listener and one web listener, a post's and a held
// line's, and asking through a dialer of each.
import { hex, isHex, unhex } from '../crypto/index.ts';
import { UNDIALED, type Dialed, type WebListener } from '../harbor/index.ts';
import { webServe } from '../http/index.ts';
import { WebDialer } from '../line/index.ts';
import { Door, freshStanding, MemoryRelations, readInvitation, Standing, tcpAddress, WardKey, webAddress, type Behind, type Choice, type Draw, type Invitation, type Payload, type Read, type Sent } from '../quo/index.ts';
import { TcpCarrier, TcpListener } from '../tcp/index.ts';

type Answer = Record<string, unknown>;
const ERRORS = ['bad request', 'no such op', 'no such ward', 'not reached', 'ward stood', 'name held'] as const;
type Error = (typeof ERRORS)[number];
class Refused {
  readonly error: Error;
  constructor(error: Error) {
    this.error = error;
  }
}
const refuse = (error: Error): never => {
  throw new Refused(error);
};

// What the verifier names behind a door.
const REACHES: Record<string, (p: Payload) => Choice> = {
  echo: (p) => ({ object: p.method === undefined ? '{}' : (p.args ?? '{}'), seen: null }),
  marked: (p) => ({ object: p.method === undefined ? '{}' : (p.args ?? '{}'), seen: p.method === undefined ? null : '1' }),
  null: () => ({ object: 'null', seen: null }),
  silent: () => ({ silence: true }),
};

class StandWard implements Behind {
  readonly door: Door;
  readonly zero: boolean;
  readonly #zero: string | undefined;
  readonly names = new Map<string, string>();
  readonly reaches = new Map<string, string>();
  readonly standings = new Map<string, { standing: Standing; last?: Sent }>();

  constructor(key: WardKey, zero: string | undefined, draw: Draw) {
    this.#zero = zero;
    this.zero = zero !== undefined;
    this.door = new Door(key, new MemoryRelations(), this, draw);
  }

  answer(heir: string | null, p: Payload): Promise<Choice> {
    const reach = heir === null ? this.#zero! : this.reaches.get(heir);
    return Promise.resolve(reach === undefined ? { silence: true } : REACHES[reach]!(p));
  }
}

const OPS = new Set(['ward', 'invite', 'release', 'arrive', 'ask', 'read', 'listen', 'route', 'send']);

export class Stand {
  readonly #wards = new Map<string, StandWard>();
  readonly #draw: Draw;
  readonly #tcp = new TcpCarrier();
  readonly #web = new WebDialer();
  readonly #routes = new Map<string, string>();
  #tcpListener: Promise<TcpListener> | undefined;
  #webListener: Promise<WebListener> | undefined;

  constructor(draw: Draw) {
    this.#draw = draw;
  }

  async close(): Promise<void> {
    await this.#tcp.close();
    await this.#web.close();
    await (await this.#tcpListener)?.close();
    await (await this.#webListener)?.close();
  }

  // Every ward this program stands, as a listener reaches them.
  readonly #doors = {
    arrive: async (pk: string, bytes: Uint8Array): Promise<Uint8Array | null> => {
      const ward = this.#wards.get(pk);
      return ward ? (await ward.door.arrive(bytes)).bytes : null;
    },
  };

  // Bytes to a ward at one address, over the carrier its scheme names.
  #dial(at: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    return tcpAddress(at) ? this.#tcp.dial(at, pk, bytes) : this.#web.dial(at, pk, bytes);
  }

  // The addresses this program listens at, for an invitation's `at`.
  async #listening(): Promise<string[]> {
    const tcp = await this.#tcpListener;
    const web = await this.#webListener;
    return [...(tcp ? [tcp.at] : []), ...(web ? web.at : [])];
  }

  async handle(line: string): Promise<Answer> {
    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      return { id: null, error: 'bad request' };
    }
    if (typeof request !== 'object' || request === null || Array.isArray(request)) return { id: null, error: 'bad request' };
    const r = request as Record<string, unknown>;
    if (typeof r.id !== 'string') return { id: null, error: 'bad request' };
    try {
      return { id: r.id, ...(await this.#op(r)) };
    } catch (e) {
      if (e instanceof Refused) return { id: r.id, error: e.error };
      throw e;
    }
  }

  async #op(r: Record<string, unknown>): Promise<Answer> {
    if (typeof r.op !== 'string') return refuse('bad request');
    if (!OPS.has(r.op)) return refuse('no such op');
    switch (r.op) {
      case 'ward':
        return this.#ward(text(r.seed), optional(r.reach));
      case 'invite':
        return this.#invite(r);
      case 'release':
        return this.#release(r);
      case 'arrive':
        return this.#arrive(r);
      case 'ask':
        return this.#ask(r);
      case 'read':
        return this.#read(r);
      case 'listen':
        return this.#listen(r.scheme);
      case 'route':
        return this.#route(r);
      default:
        return this.#send(r);
    }
  }

  // One listener of a scheme this program stands, answering for every ward
  // it stands.
  async #listen(scheme: unknown): Promise<Answer> {
    if (scheme === undefined || scheme === 'tcp') {
      this.#tcpListener ??= TcpListener.listen(this.#doors);
      return { at: (await this.#tcpListener).at };
    }
    if (scheme !== 'http' && scheme !== 'ws') return refuse('bad request');
    this.#webListener ??= webServe(this.#doors, { host: '127.0.0.1', port: 0, path: '/quo', origins: ['*'] });
    return { at: (await this.#webListener).at.find((at) => at.startsWith(`${scheme}:`))! };
  }

  #route(r: Record<string, unknown>): Answer {
    const far = r.far;
    if (!isHex(far, 64) || (tcpAddress(r.at) === null && webAddress(r.at) === null)) return refuse('bad request');
    this.#routes.set(far, r.at as string);
    return { routed: far };
  }

  async #send(r: Record<string, unknown>): Promise<Answer> {
    const invitation = inviteOf(r.invitation);
    const method = r.method === undefined ? undefined : text(r.method);
    const args = r.args === undefined ? undefined : objectText(r.args);
    const ward = this.#ward_(r.ward);
    const held = this.#standing(ward, invitation);
    const sent = await held.standing.ask(method, args);
    if (sent === null) return refuse('bad request');
    held.last = sent;
    const far = invitation.ward;
    const route = this.#routes.get(far);
    let reply: Uint8Array | null = null;
    for (const at of route === undefined ? (invitation.at ?? []) : [route]) {
      const out = await this.#dial(at, far, sent.bytes);
      if (out === UNDIALED) continue;
      reply = out;
      break;
    }
    return { read: readOf(await held.standing.read(sent, reply)) };
  }

  async #ward(seed: string, reach: string | undefined): Promise<Answer> {
    reached(reach);
    const key = await WardKey.from(seed);
    if (this.#wards.has(key.pk)) refuse('ward stood');
    this.#wards.set(key.pk, new StandWard(key, reach, this.#draw));
    return { ward: key.pk };
  }

  async #invite(r: Record<string, unknown>): Promise<Answer> {
    const name = text(r.heir);
    const reach = optional(r.reach) ?? 'echo';
    const ward = this.#ward_(r.ward);
    reached(reach);
    if (ward.names.has(name)) refuse('name held');
    const { heir, invitation } = await ward.door.invite(await this.#listening());
    ward.names.set(name, heir);
    ward.reaches.set(heir, reach);
    return { invitation };
  }

  #release(r: Record<string, unknown>): Answer {
    const name = text(r.heir);
    const ward = this.#ward_(r.ward);
    const heir = ward.names.get(name);
    if (heir === undefined) return { released: null };
    ward.names.delete(name);
    ward.door.remove(heir);
    return { released: name };
  }

  async #arrive(r: Record<string, unknown>): Promise<Answer> {
    const box = r.box;
    if (!isHex(box)) return refuse('bad request');
    const ward = this.#ward_(r.ward);
    const judged = await ward.door.arrive(unhex(box));
    return { reply: hex(judged.bytes) };
  }

  async #ask(r: Record<string, unknown>): Promise<Answer> {
    const invitation = inviteOf(r.invitation);
    const method = r.method === undefined ? undefined : text(r.method);
    const args = r.args === undefined ? undefined : objectText(r.args);
    const ward = this.#ward_(r.ward);
    const held = this.#standing(ward, invitation);
    const sent = await held.standing.ask(method, args);
    if (sent === null) return refuse('bad request');
    held.last = sent;
    return { box: hex(sent.bytes) };
  }

  async #read(r: Record<string, unknown>): Promise<Answer> {
    const invitation = inviteOf(r.invitation);
    if (r.reply !== null && !isHex(r.reply)) return refuse('bad request');
    const ward = this.#ward_(r.ward);
    const held = this.#standing(ward, invitation);
    if (held.last === undefined) return refuse('bad request');
    const read = await held.standing.read(held.last, r.reply === null ? null : unhex(r.reply as string));
    return { read: readOf(read) };
  }

  #standing(ward: StandWard, invitation: Invitation): { standing: Standing; last?: Sent } {
    const key = `${invitation.ward}.${invitation.heir}`;
    let held = ward.standings.get(key);
    if (!held) ward.standings.set(key, (held = { standing: new Standing(invitation, freshStanding(), this.#draw) }));
    return held;
  }

  #ward_(pk: unknown): StandWard {
    if (!isHex(pk, 64)) return refuse('bad request');
    return this.#wards.get(pk) ?? refuse('no such ward');
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value : refuse('bad request'));
const optional = (value: unknown): string | undefined => (value === undefined ? undefined : text(value));
const reached = (reach: string | undefined): void => {
  if (reach !== undefined && !Object.hasOwn(REACHES, reach)) refuse('not reached');
};
const inviteOf = (value: unknown): Invitation => readInvitation(value) ?? refuse('bad request');
const objectText = (value: unknown): string => (typeof value === 'object' && value !== null && !Array.isArray(value) ? JSON.stringify(value) : refuse('bad request'));
const readOf = (read: Read): unknown => ('object' in read ? { object: JSON.parse(read.object) as unknown, seen: read.seen } : read);
