// SPDX-License-Identifier: Apache-2.0
// The ward: the contract of the being that stewards one Quo ward through
// its house, the first being of every ward. Her asks are the root's, shown
// and answered to whoever pilots. The core names no class of it. Her class
// is her row's kind, and `become` names another.
//
// Every ward also holds far beings as their owner, each under a name: `hold`
// takes an owner invitation on any being of any harbor, `pilot` asks it, and
// `drop` lets it go. A held being is an ordinary standing of the ward's,
// under `held:<name>`, kept in her partition, so it moves its keys and
// survives a restart as every relation does.
import { Being, isSilence, isWord, kindOf, OWNER, shipped, ships, told, type Answer, type Asker, type AskSpec, type BeingClass, type Blueprint, type Invitation, type JsonObject, type Stance } from '../being/index.ts';
import { readInvitation } from '../quo/index.ts';

// What the house lends its ward, and no other being.
export interface Steward {
  pk(): string;
  classOf(name: string, registry?: string): BeingClass | undefined;
  beings(): Record<string, { class: string; registry?: string; public: boolean; absent: boolean }>;
  // A new being, her class resolved through the registry named, or the
  // house's own.
  boot(key: string, className: string, registry?: string): Promise<'booted' | 'key taken' | 'no such class' | 'threw at birth'>;
  // A being her row names, stood where she does not stand yet, in a house
  // whose beings stand: the box ward's faculties.
  stand(key: string): 'booted' | 'stands' | 'no such being' | 'no such class' | 'threw at birth';
  unboot(key: string): boolean;
  publish(key: string | null): boolean;
  invite(being: string, id: string, notes: JsonObject): Promise<Invitation | null>;
  ask(being: string | null, method: string | undefined, args: JsonObject): Promise<Answer>;
  // The ward born again of the class of this kind, on her stance, resolved
  // through the registry named or the house's own: null, or why not.
  become(kind: string, registry?: string): string | null;
}

export type WardStance = Stance & { readonly steward: Steward };

// Whoever pilots a ward: the root, holding its unsealed ask, or an owner,
// an occupant of the ward the root invited as one.
export const pilots = (asker: Asker, notes: JsonObject | undefined): boolean => asker.id === OWNER || notes?.owner === true;

// An ask whoever pilots the ward may make.
export const ownerAsk = (description: string, input: JsonObject = {}): AskSpec => ({ description, input: { type: 'object', ...input }, for: pilots });

// An ask the root alone may make, so a carried key pilots but never hands
// piloting on.
export const rootAsk = (description: string, input: JsonObject = {}): AskSpec => ({ description, input: { type: 'object', ...input }, for: (asker: Asker) => asker.id === OWNER });

// The standing a far being held under a name is kept under. No other
// standing of a ward takes this prefix: the dock's are her faculties' keys
// and a hosted ward's is `dock`, and a take under an id already held is
// refused, so a collision is refused and never overwrites.
export const HELD = 'held:';

const text = (v: unknown): v is string => typeof v === 'string';
const object = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

export abstract class Ward extends Being {
  static override readonly kind: string = 'org.nervur.ward';
  static {
    ships(this);
  }
  static override asks: Record<string, AskSpec> = {
    boot: ownerAsk('a new being of this ward', { required: ['key', 'class'] }),
    unboot: ownerAsk('a being out, with every relation she holds', { required: ['being'] }),
    public: ownerAsk('the being a stranger reaches, or none', { required: ['key'] }),
    invite: ownerAsk('an invitation on a being of this ward', { required: ['being', 'id'] }),
    ask: ownerAsk('a being of this ward, asked as the owner; with no being, the public being asked as nobody'),
    own: rootAsk('an invitation for an owner of this ward, under an id', { required: ['id'] }),
    disown: rootAsk('an owner no more', { required: ['id'] }),
    become: ownerAsk('this ward born again of the class of a kind, her cells and relations kept', { required: ['class'] }),
    hold: ownerAsk('an owner invitation on a far being, held under a name from now on', { required: ['name', 'invitation'] }),
    pilot: ownerAsk('the far being held under a name, asked as its owner', { required: ['name'] }),
    drop: ownerAsk('the far being held under a name, let go', { required: ['name'] }),
  };

  readonly steward: Steward;

  // A ward is born of her stance alone, and a ward's stance carries her
  // steward.
  constructor(stance: Stance) {
    super(stance);
    this.steward = (stance as WardStance).steward;
  }

  // Whether a class fulfils this contract: this class, or one below it.
  static fulfils(C: unknown): C is BeingClass {
    return typeof C === 'function' && C.prototype instanceof this;
  }

  become(args: JsonObject): JsonObject {
    if (!text(args.class)) return { error: 'class is text' };
    const refused = this.steward.become(args.class);
    return refused === null ? { became: args.class } : { error: refused };
  }

  override describe(asker: Asker): Blueprint {
    const { asks } = super.describe(asker);
    return { asks, notes: pilots(asker, this.notes(asker)) ? { pk: this.steward.pk(), class: kindOf(this.constructor), beings: this.steward.beings() } : {} };
  }

  async own(args: JsonObject): Promise<JsonObject> {
    if (!text(args.id)) return { error: 'id is text' };
    return (await this.stance.occupants.invite(args.id, { owner: true })) ?? { error: 'id taken' };
  }

  disown(args: JsonObject): JsonObject {
    if (!text(args.id) || this.stance.occupants.notes(args.id)?.owner !== true) return { error: 'no such owner' };
    this.stance.occupants.remove(args.id);
    return { disowned: args.id };
  }

  async boot(args: JsonObject): Promise<JsonObject> {
    if (!text(args.key) || !text(args.class)) return { error: 'key and class are text' };
    if (shipped(this.steward.classOf(args.class))) return { error: 'no such class' };
    const out = await this.steward.boot(args.key, args.class);
    return out === 'booted' ? { booted: args.key } : { error: out };
  }

  unboot(args: JsonObject): JsonObject | Promise<JsonObject> {
    return text(args.being) && this.steward.unboot(args.being) ? { unbooted: args.being } : { error: 'no such being' };
  }

  public(args: JsonObject): JsonObject {
    if (args.key !== null && !text(args.key)) return { error: 'key is text or null' };
    return this.steward.publish(args.key) ? { public: args.key } : { error: 'no such being' };
  }

  async invite(args: JsonObject): Promise<JsonObject> {
    if (!text(args.being) || !text(args.id) || (args.notes !== undefined && !object(args.notes))) return { error: 'being and id are text, notes an object' };
    const invitation = await this.steward.invite(args.being, args.id, args.notes ?? {});
    return invitation ?? { error: 'not invited' };
  }

  async ask(args: JsonObject): Promise<JsonObject> {
    if ((args.being !== undefined && !text(args.being)) || (args.method !== undefined && !text(args.method)) || (args.args !== undefined && !object(args.args))) {
      return { error: 'being and method are text, args an object' };
    }
    const out = await this.steward.ask(args.being ?? null, args.method, args.args ?? {});
    if (isSilence(out)) return { error: 'silence' };
    if (isWord(out)) return { error: told(out) as string };
    return { answer: out };
  }

  async hold(args: JsonObject): Promise<JsonObject> {
    if (!text(args.name)) return { error: 'name is text' };
    const invitation = readInvitation(args.invitation);
    if (invitation === null) return { error: 'no invitation' };
    if (this.stance.standings.get(HELD + args.name)) return { error: `${args.name} is held` };
    return (await this.stance.standings.take(HELD + args.name, invitation)) === null ? { error: 'not taken' } : { held: args.name, ward: invitation.ward };
  }

  async pilot(args: JsonObject): Promise<JsonObject> {
    if (!text(args.name) || (args.method !== undefined && !text(args.method)) || (args.args !== undefined && !object(args.args))) return { error: 'name and method are text, args an object' };
    const standing = this.stance.standings.get(HELD + args.name);
    if (!standing) return { error: `${args.name} is not held` };
    const out = await standing.ask(args.method, args.args ?? {});
    if (isSilence(out)) return { error: 'silence' };
    if (isWord(out)) return { error: told(out) as string };
    return { answer: out };
  }

  drop(args: JsonObject): JsonObject {
    if (!text(args.name)) return { error: 'name is text' };
    return this.stance.standings.remove(HELD + args.name) ? { dropped: args.name } : { error: `${args.name} is not held` };
  }
}
