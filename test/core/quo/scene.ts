// SPDX-License-Identifier: Apache-2.0
// The thinnest world: wards that are a door each, reached by pk through a
// map, with weather between them. A scenario written here runs again at
// every layer that stands on `quo/`.
import { Door, freshStanding, MemoryRelations, Standing, WardKey, type Behind, type Choice, type Invitation, type Payload, type Read, type Sent } from '../../../src/core/quo/index.ts';

export const draw = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

// Behind a scene ward: every named ask echoes its args with the heir that
// asked, and a heir can be told to keep silent.
export class Echo implements Behind {
  readonly zero = false;
  readonly silent = new Set<string>();
  readonly heard: { heir: string | null; method?: string }[] = [];
  answer(heir: string | null, p: Payload): Promise<Choice> {
    this.heard.push({ heir, ...(p.method === undefined ? {} : { method: p.method }) });
    if (heir !== null && this.silent.has(heir)) return Promise.resolve({ silence: true });
    return Promise.resolve({ object: `{"heir":${JSON.stringify(heir)},"args":${p.args ?? '{}'}}`, seen: null });
  }
}

export type SceneWard = { name: string; door: Door; relations: MemoryRelations; behind: Echo };

// What the weather does to the next box on a route.
export type Weather = 'lose ask' | 'lose reply' | 'twice';

export class Scene {
  readonly #wards = new Map<string, SceneWard>();
  readonly #byName = new Map<string, SceneWard>();
  readonly #weather: Weather[] = [];
  readonly cut = new Set<string>();

  async ward(name: string): Promise<SceneWard> {
    const key = await WardKey.from(name);
    const relations = new MemoryRelations();
    const behind = new Echo();
    const ward = { name, door: new Door(key, relations, behind, draw), relations, behind };
    this.#wards.set(key.pk, ward);
    this.#byName.set(name, ward);
    return ward;
  }

  weather(...next: Weather[]): void {
    this.#weather.push(...next);
  }

  // Bytes to a ward pk, or nothing.
  async carry(pk: string, bytes: Uint8Array): Promise<{ reply: Uint8Array | null; twice?: Uint8Array }> {
    const ward = this.#wards.get(pk);
    const weather = this.#weather.shift();
    if (!ward || this.cut.has(ward.name) || weather === 'lose ask') return { reply: null };
    const judged = await ward.door.arrive(bytes);
    if (weather === 'twice') return { reply: judged.bytes, twice: (await ward.door.arrive(bytes)).bytes };
    return { reply: weather === 'lose reply' ? null : judged.bytes };
  }
}

// One standing held by whoever took the invitation.
export class Holder {
  readonly standing: Standing;
  readonly #scene: Scene;
  last: Sent | undefined;

  constructor(scene: Scene, invitation: Invitation) {
    this.#scene = scene;
    this.standing = new Standing(invitation, freshStanding(), draw);
  }

  async ask(method?: string, args?: object): Promise<Read> {
    const sent = await this.standing.ask(method, args === undefined ? undefined : JSON.stringify(args));
    if (!sent) throw new Error('nothing sealed');
    this.last = sent;
    const { reply } = await this.#scene.carry(this.standing.invitation.ward, sent.bytes);
    return this.standing.read(sent, reply);
  }
}

export const objectOf = (read: Read): unknown => ('object' in read ? JSON.parse(read.object) : read);
