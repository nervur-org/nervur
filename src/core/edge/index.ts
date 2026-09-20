// SPDX-License-Identifier: Apache-2.0
// `nervur/edge`: the edge ground, Cloudflare Workers with a Durable Object
// per harbor. The deployed worker is a shell that never runs a harbor's
// code: each of its objects holds one harbor's storage and its web door,
// and runs the whole harbor, the kit and the modules its `live` commit
// holds, in a child worker Cloudflare's Worker Loader makes of them, as a
// facet of the object keeping its storage. Moving `live` loads the next
// child, so code reaches an edge with no deploy. The shell answers Quo
// over the web, a post or a held line, since a worker takes no inbound
// TCP, handing each box to the child; the harbor asks over TCP and the
// web from the child.
//
// One worker carries many harbors, each a Durable Object by its name,
// answering at `/<name>/quo`, and one secret, `NERVUR_SECRET`, for all of
// them. A harbor born on another ground is carried here in a pack: by
// name, its seed sealed under that secret and its sealed places, bundled
// with the worker and landed the first time its child starts. So a
// harbor is added by a deploy, never by a new secret. Its owner holds the
// owner invitation minted where it was born, and pilots it over the web.
//
//   m/<place>/<name>   one sealed entry of the harbor's memory
//   c/seed             the seed, sealed under a key from the secret
//
// A keep is one storage transaction, whole or nothing. The storage, state
// and loader types name only what the kit uses, so no Cloudflare package
// is a dependency.
import type { JsonObject } from '../being/index.ts';
import { Custody, Loader, Memory, moduleOf, type Entropy, type Module } from '../contract/index.ts';
import { concat, decrypt, encrypt, hex, hkdf, isHex, sha256, unhex, utf8 } from '../crypto/index.ts';
import { carrierIn, Harbor, landPlaces, probeGround, readCarried, UNDIALED, type Arrivals, type Carried, type Defaults, type Dialed, type GroundProbe, type Sockets, type TcpListening, type WebListen, type WebListener } from '../harbor/index.ts';
import { answerHeld, answerPost, askFrame, FrameReader } from '../line/index.ts';
import { CryptoEntropy, PointerTerrain } from '../pointer/index.ts';
import { tcpAddress, tcpAt, type TcpAddress } from '../quo/index.ts';

export type { Carried } from '../harbor/index.ts';

export const EDGE = 'edge';
const ENTRY = 'm/';
const SEED = 'c/seed';
// The most keys one storage call takes.
const BATCH = 128;
const SEAL_INFO = utf8('nervur edge custody');
const MAX_ID = 0xffff_ffff;

export interface EdgeStorage {
  get(key: string): Promise<unknown>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
  list(options: { prefix: string }): Promise<Map<string, unknown>>;
  transaction<T>(work: (txn: EdgeStorage) => Promise<T>): Promise<T>;
}
export interface EdgeState {
  readonly storage: EdgeStorage;
  blockConcurrencyWhile<T>(work: () => Promise<T>): Promise<T>;
}
export type EdgeEnv = { readonly NERVUR_SECRET?: string };
// What the child hands its harbor: its state, the worker's environment,
// the loader of the modules the child carries, its calls, and a packed
// harbor to land where the storage keeps no seed yet.
export type EdgeGiven = { readonly state: EdgeState; readonly env: EdgeEnv; readonly loader?: EdgeLoader; readonly calls?: ChildCalls; readonly package?: Packed };

// A module a child carries: the module its worker imported, by its blob's
// id.
export type CarriedModule = { readonly blob: string; readonly module: unknown };

// Which call of a child runs now: an `AsyncLocalStorage` the child's main
// module hands in.
export type CallContext = { run<R>(call: number, work: () => R): R; getStore(): number | undefined };

// The calls of a child, each by the number the shell gave it, and what
// each did to the memory: a miss or a refused keep is told to the call it
// happened in and to no other, and so is a keep that landed. A call that
// was refused and kept nothing is asked again whole in the next child. One
// that kept a step before it was refused, a line's seq before it asked
// out, is not, since a box asked again would find that step taken: it
// answers what the child answered, as after a crash.
export class ChildCalls {
  readonly #context: CallContext | undefined;
  readonly #refused = new Set<number>();
  readonly #kept = new Set<number>();
  constructor(context?: CallContext) {
    this.#context = context;
  }

  run<R>(call: number, work: () => R): R {
    return this.#context ? this.#context.run(call, work) : work();
  }

  // The call running now missed a module, or had a keep refused.
  refused(): void {
    const call = this.#context?.getStore();
    if (call !== undefined) this.#refused.add(call);
  }

  // A keep of the call running now landed.
  kept(): void {
    const call = this.#context?.getStore();
    if (call !== undefined) this.#kept.add(call);
  }

  // Whether a call that ended kept nothing and was refused, so it is asked
  // again; told once per call.
  again(call: number): boolean {
    const again = this.#refused.delete(call) && !this.#kept.has(call);
    this.#kept.delete(call);
    return again;
  }
}

// The edge's loader: the modules its child was loaded with, each found by
// its blob's id. A blob it does not carry is a miss, kept with its source,
// so the shell loads the next child carrying it and asks again; a blob the
// shell found does not load here is refused with its reason. From the
// first miss the child is spent and its memory keeps nothing more, since a
// ward keeps every row it was told at once and the call that missed told
// some, the seq of the box it opened among them.
export class EdgeLoader extends Loader {
  readonly #carried: ReadonlyMap<string, unknown>;
  readonly #refused = new Map<string, string>();
  readonly #missed = new Map<string, string>();
  readonly #calls: ChildCalls | undefined;
  constructor(carried: readonly CarriedModule[] = [], calls?: ChildCalls) {
    super();
    this.#carried = new Map(carried.map((c) => [c.blob, c.module]));
    this.#calls = calls;
  }

  get carried(): string[] {
    return [...this.#carried.keys()];
  }

  refuse(refused: Readonly<Record<string, string>>): void {
    for (const [blob, reason] of Object.entries(refused)) this.#refused.set(blob, reason);
  }

  get refused(): ReadonlyMap<string, string> {
    return this.#refused;
  }

  load(source: string, id: string): Promise<Module> {
    if (this.#carried.has(id)) return Promise.resolve().then(() => moduleOf(this.#carried.get(id)));
    const refused = this.#refused.get(id);
    if (refused !== undefined) return Promise.reject(new Error(refused));
    this.#missed.set(id, source);
    this.#calls?.refused();
    return Promise.reject(new Error(`blob ${id} is carried by the next child`));
  }

  // Whether the child missed a blob, so it is spent.
  get missing(): boolean {
    return this.#missed.size > 0;
  }

  // Every blob the child missed, with its source.
  missed(): Map<string, string> {
    return new Map(this.#missed);
  }
}

// One harbor packed for an edge: its seed sealed under the worker's
// secret, as hex of the nonce and the sealed bytes, and its sealed places.
// A pack is every harbor of a worker, by name.
export type Packed = { readonly sealed: string; readonly places: Carried['places'] };
export type Pack = Record<string, Packed>;

// A harbor's name on the edge: one path segment, so it is where the
// harbor answers, `/<name>/quo`.
export const isHarborName = (name: unknown): name is string => typeof name === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(name);
const NONCE = 12;

// A pack as JSON reads, or null for anything else.
export const readPack = (value: unknown): Pack | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const pack: Record<string, Packed> = {};
  for (const [name, entry] of Object.entries(value)) {
    const { sealed, places } = (entry ?? {}) as { sealed?: unknown; places?: unknown };
    const carried = readCarried({ places });
    if (!isHarborName(name) || !isHex(sealed) || (sealed as string).length <= NONCE * 2 || carried === null) return null;
    pack[name] = { sealed: sealed as string, places: carried.places };
  }
  return pack;
};

const sealKey = (secret: string): Promise<Uint8Array> => hkdf(utf8(secret), SEAL_INFO, 32);

// A seed sealed under a worker's secret, as a pack keeps it.
export const sealSeed = async (secret: string, seed: Uint8Array, entropy: Entropy = new CryptoEntropy()): Promise<string> => {
  const nonce = entropy.draw(NONCE);
  return hex(concat(nonce, await encrypt(await sealKey(secret), nonce, new Uint8Array(0), seed)));
};

const chunks = <T>(items: readonly T[]): T[][] => Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) => items.slice(i * BATCH, (i + 1) * BATCH));
const bytesOf = (value: unknown): Uint8Array => new Uint8Array(value instanceof ArrayBuffer ? value : (value as Uint8Array));

// A body keeps its keys under `root`, so one object may hold more than one
// keeping.
// A body refuses every keep while `voided` says so: in a child, from the
// moment its loader misses a module, so a spent child keeps nothing more,
// and tells the child's calls which keeps it refused and which landed.
export class EdgeMemory extends Memory {
  readonly #storage: EdgeStorage;
  readonly #entry: string;
  readonly #voided: () => boolean;
  readonly #calls: ChildCalls | undefined;
  constructor(storage: EdgeStorage, root = '', voided: () => boolean = () => false, calls?: ChildCalls) {
    super();
    this.#storage = storage;
    this.#entry = `${root}${ENTRY}`;
    this.#voided = voided;
    this.#calls = calls;
  }

  #refuse(): Promise<void> | null {
    if (!this.#voided()) return null;
    this.#calls?.refused();
    return Promise.reject(new Error('a module was missed, so this call keeps nothing'));
  }

  async read(place: string): Promise<Map<string, Uint8Array>> {
    const prefix = `${this.#entry}${place}/`;
    const listed = await this.#storage.list({ prefix });
    return new Map([...listed].map(([key, value]) => [key.slice(prefix.length), bytesOf(value).slice()]));
  }

  write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    const refused = this.#refuse();
    if (refused) return refused;
    const put: [string, Uint8Array][] = [];
    const gone: string[] = [];
    for (const [name, bytes] of entries) {
      if (bytes === null) gone.push(`${this.#entry}${place}/${name}`);
      else put.push([`${this.#entry}${place}/${name}`, bytes.slice()]);
    }
    return this.#storage
      .transaction(async (txn) => {
        for (const batch of chunks(put)) await txn.put(Object.fromEntries(batch));
        for (const batch of chunks(gone)) await txn.delete(batch);
      })
      .then(() => this.#calls?.kept());
  }

  async places(): Promise<string[]> {
    const entry = this.#entry;
    const keys = [...(await this.#storage.list({ prefix: entry })).keys()];
    return [...new Set(keys.map((key) => key.slice(entry.length, key.indexOf('/', entry.length))))];
  }

  async forget(place: string): Promise<void> {
    await this.#refuse();
    const keys = [...(await this.#storage.list({ prefix: `${this.#entry}${place}/` })).keys()];
    await this.#storage.transaction(async (txn) => {
      for (const batch of chunks(keys)) await txn.delete(batch);
    });
    this.#calls?.kept();
  }
}

// The seed, kept sealed under a key the worker's secret gives, so the
// storage alone opens nothing: the one a pack landed, or one drawn the
// first time it is asked for. A worker with no secret stands no harbor.
export class EdgeCustody extends Custody {
  readonly #storage: EdgeStorage;
  readonly #secret: string | undefined;
  readonly #entropy: Entropy;
  readonly #key: string;
  constructor(storage: EdgeStorage, secret: string | undefined, entropy: Entropy = new CryptoEntropy(), root = '') {
    super();
    this.#storage = storage;
    this.#secret = secret;
    this.#entropy = entropy;
    this.#key = `${root}${SEED}`;
  }

  // Whether a seed is kept, so a pack lands only where none is.
  async kept(): Promise<boolean> {
    return (await this.#storage.get(this.#key)) !== undefined;
  }

  // A packed seed, sealed as `sealSeed` sealed it, kept as it came.
  async land(sealed: string, txn: EdgeStorage = this.#storage): Promise<void> {
    const bytes = unhex(sealed);
    await txn.put({ [this.#key]: { nonce: bytes.slice(0, NONCE), sealed: bytes.slice(NONCE) } });
  }

  async seed(): Promise<Uint8Array> {
    if (!this.#secret) throw new Error('the worker holds no NERVUR_SECRET');
    const key = await sealKey(this.#secret);
    return this.#storage.transaction(async (txn) => {
      const kept = (await txn.get(this.#key)) as { nonce: Uint8Array; sealed: Uint8Array } | undefined;
      if (kept) {
        const seed = await decrypt(key, bytesOf(kept.nonce), new Uint8Array(0), bytesOf(kept.sealed));
        if (seed === null) throw new Error('the seed does not open under this NERVUR_SECRET');
        return seed;
      }
      const seed = this.#entropy.draw(32);
      const nonce = this.#entropy.draw(NONCE);
      await txn.put({ [this.#key]: { nonce, sealed: await encrypt(key, nonce, new Uint8Array(0), seed) } });
      return seed.slice();
    });
  }
}

// One TCP line opened by the worker's `connect`, many asks on it.
type EdgeSocket = {
  readonly opened: Promise<unknown>;
  readonly closed: Promise<unknown>;
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
};
type Connect = (address: { hostname: string; port: number }) => EdgeSocket;

class EdgeLine {
  readonly #socket: EdgeSocket;
  readonly #writer: WritableStreamDefaultWriter<Uint8Array>;
  readonly #waiting = new Map<number, (box: Uint8Array | null) => void>();
  #next = 1;
  #closed = false;

  constructor(socket: EdgeSocket, onClose: () => void) {
    this.#socket = socket;
    this.#writer = socket.writable.getWriter();
    const reader = new FrameReader();
    void (async () => {
      try {
        for await (const chunk of socket.readable) {
          for (const frame of reader.push(new Uint8Array(chunk))) {
            if (frame.kind === 'ask') continue;
            const done = this.#waiting.get(frame.id);
            this.#waiting.delete(frame.id);
            done?.(frame.kind === 'reply' ? frame.box : null);
          }
          if (reader.bad) break;
        }
      } catch {
        // A line that broke answers nothing more.
      }
      this.#closed = true;
      onClose();
      for (const done of this.#waiting.values()) done(null);
      this.#waiting.clear();
      await socket.close().catch(() => undefined);
    })();
  }

  ask(pk: Uint8Array, box: Uint8Array): Promise<Uint8Array | null> {
    if (this.#closed) return Promise.resolve(null);
    const id = this.#next;
    this.#next = this.#next === MAX_ID ? 1 : this.#next + 1;
    return new Promise((resolve) => {
      this.#waiting.set(id, resolve);
      this.#writer.write(askFrame(id, pk, box)).catch(() => resolve(null));
    });
  }

  close(): Promise<void> {
    this.#closed = true;
    return this.#socket.close().catch(() => undefined);
  }
}

const sockets = 'cloudflare:sockets';
const connector = async (): Promise<Connect | null> => {
  try {
    return ((await import(/* @vite-ignore */ sockets)) as { connect: Connect }).connect;
  } catch {
    return null;
  }
};

// The worker's sockets under the TCP carrier: it dials on the worker's
// `connect`, one line per address, and takes no inbound TCP.
export class EdgeSockets implements Sockets {
  readonly #lines = new Map<string, Promise<EdgeLine | null>>();

  async dial(address: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    const at = tcpAddress(address);
    if (at === null || !isHex(pk, 64)) return UNDIALED;
    const line = await this.#line(at);
    return line ? line.ask(unhex(pk), bytes) : UNDIALED;
  }

  #line({ host, port }: TcpAddress): Promise<EdgeLine | null> {
    const at = tcpAt(host, port);
    let line = this.#lines.get(at);
    if (!line) {
      line = (async () => {
        const connect = await connector();
        if (!connect) return null;
        try {
          const socket = connect({ hostname: host, port });
          await socket.opened;
          return new EdgeLine(socket, () => this.#lines.delete(at));
        } catch {
          return null;
        }
      })();
      this.#lines.set(at, line);
      void line.then((open) => open ?? this.#lines.delete(at));
    }
    return line;
  }

  listen(): Promise<TcpListening> {
    return Promise.reject(new Error('an edge takes no inbound TCP'));
  }

  async close(): Promise<void> {
    const lines = [...this.#lines.values()];
    this.#lines.clear();
    for (const line of await Promise.all(lines)) await line?.close();
  }
}

// Where the edge's web carrier listens: the object's own requests, at the
// host and path its cells name. A port of 0 is the edge's own https.
type Listening = { at: WebListen | undefined };
const edgeServe = (listening: Listening, listen: WebListen): Promise<WebListener> => {
  listening.at = listen;
  const authority = listen.port === 0 ? listen.host : `${tcpAt(listen.host, listen.port).slice('tcp://'.length)}`;
  const [post, held] = listen.port === 0 ? ['https', 'wss'] : ['http', 'ws'];
  return Promise.resolve({
    port: listen.port,
    at: [`${post}://${authority}${listen.path}`, `${held}://${authority}${listen.path}`],
    close: () => {
      if (listening.at === listen) listening.at = undefined;
      return Promise.resolve();
    },
  });
};

export type EdgeParts = { readonly given: EdgeGiven; readonly defaults: Defaults };

export class EdgeTerrain extends PointerTerrain {
  readonly given: EdgeGiven;
  readonly #listening: Listening;

  constructor(parts: EdgeParts) {
    const entropy = new CryptoEntropy();
    const { storage } = parts.given.state;
    const loader = parts.given.loader ?? new EdgeLoader();
    const listening: Listening = { at: undefined };
    super({
      entropy,
      loader,
      custody: new EdgeCustody(storage, parts.given.env.NERVUR_SECRET, entropy),
      memory: new EdgeMemory(storage, '', () => loader.missing, parts.given.calls),
      tcp: () => new EdgeSockets(),
      web: (_ground, listen) => edgeServe(listening, listen),
      defaults: parts.defaults,
    });
    this.given = parts.given;
    this.#listening = listening;
  }

  // Where the web carrier listens now, which the shell answers at.
  get listening(): WebListen | undefined {
    return this.#listening.at;
  }

  // A packed harbor lands where the object keeps no seed yet: its places
  // first and its seed last, so a start cut short lands it whole again,
  // and once the seed is kept the storage is the harbor and a new deploy
  // leaves it be. A seed sealed under another secret does not open.
  override async claim(): Promise<void> {
    const packed = this.given.package;
    const custody = this.custody as EdgeCustody;
    if (!packed || (await custody.kept())) return;
    await landPlaces(this.memory, { places: packed.places });
    await custody.land(packed.sealed);
  }

}

const isGiven = (value: unknown): value is EdgeGiven => {
  const given = value as Partial<EdgeGiven> | null;
  return typeof given?.state?.storage?.transaction === 'function' && typeof given.env === 'object';
};

// A harbor handed a Durable Object's state and environment, and the
// loader of the modules its child carries.
export const edgeGround: GroundProbe = {
  name: EDGE,
  fits: ({ given }) => isGiven(given),
  terrain: ({ given }, defaults) => new EdgeTerrain({ given: given as EdgeGiven, defaults }),
};

// The harbor a request is for: the first segment of its path.
export const harborNameOf = (request: Request): string | null => {
  const name = new URL(request.url).pathname.split('/')[1];
  return isHarborName(name) ? name : null;
};

// What a child tells its shell after a call, where the shell must move:
// the commit `live` names and its modules' blobs, the modules the next
// child carries, by blob with their sources, and the blobs the child
// missed, which the next child carries beside them.
export type Wanted = {
  readonly live: string;
  readonly liveBlobs: readonly string[];
  readonly modules: Readonly<Record<string, string>>;
  readonly missed: readonly string[];
};
export type Opened = { readonly listen: WebListen | null; readonly wanted: Wanted | null };
// `again` where the call kept nothing and was refused, by a miss of its own
// or in a spent child, so it is asked again in the next child.
export type Arrived = { readonly reply: Uint8Array | null; readonly wanted: Wanted | null; readonly again: boolean };

// The key a child is loaded under: the commit `live` names, where the
// child carries that commit's modules, and else that commit and every
// blob the child carries.
export const childKey = (live: string, blobs: readonly string[], liveBlobs: readonly string[]): string => {
  const carried = [...new Set(blobs)].sort();
  const same = carried.length === new Set(liveBlobs).size && liveBlobs.every((b) => carried.includes(b));
  return same ? live : `${live}+${carried.join('+')}`;
};

// The whole harbor inside a child: its bodies on the storage the facet
// keeps, its loader over the modules the child's worker imported, and the
// web door the shell hands each box through. It opens the harbor once, and
// after every call says whether the shell must move to another child.
export class HarborChild {
  readonly #state: EdgeState;
  readonly #env: EdgeEnv;
  readonly #key: string;
  readonly #loader: EdgeLoader;
  readonly #calls: ChildCalls;
  #opening: Promise<Harbor> | undefined;
  // The terrain the child opened its harbor on, which says where its web
  // carrier listens.
  #terrain: EdgeTerrain | undefined;
  #settled: string | undefined;

  constructor(state: EdgeState, env: EdgeEnv, key: string, carried: readonly CarriedModule[], context: CallContext) {
    this.#state = state;
    this.#env = env;
    this.#key = key;
    this.#calls = new ChildCalls(context);
    this.#loader = new EdgeLoader(carried, this.#calls);
  }

  // The harbor, opened inside the object's block so no call reaches it
  // half open, its web carrier listening at `/<name>/quo`. A child that
  // missed a module of `live` as the harbor booted stands nothing more:
  // the shell moves to the next before it hands this one a call.
  async open(name: string, host: string, port: number, packed: Packed | null, refused: Readonly<Record<string, string>>): Promise<Opened> {
    this.#loader.refuse(refused);
    this.#opening ??= this.#state.blockConcurrencyWhile(async () => {
      const terrain = probeGround({ given: { state: this.#state, env: this.#env, loader: this.#loader, calls: this.#calls, ...(packed ? { package: packed } : {}) } }).terrain as EdgeTerrain;
      this.#terrain = terrain;
      const harbor = await Harbor.open(terrain);
      if (this.#loader.missing) return harbor;
      await harbor.ask({ method: 'stand' });
      const { beings } = ((await harbor.ask({})).answer as { notes: { beings: Record<string, { class: string }> } }).notes;
      const web = carrierIn(beings, terrain.defaults.classes, 'web');
      if (web === null) throw new Error('no class this edge runs carries web');
      if (web.open !== undefined) await harbor.ask(web.open);
      if (terrain.listening?.path !== `/${name}/quo`) await harbor.ask({ method: 'ask', args: { being: web.key, method: 'listen', args: { host, port, path: `/${name}/quo` } } });
      return harbor;
    });
    const harbor = await this.#opening;
    const at = this.#terrain?.listening;
    // A plain copy, since what crosses to the shell is cloned.
    const listen = at ? { host: at.host, port: at.port, path: at.path, origins: [...at.origins] } : null;
    return { listen, wanted: await this.#wanted(harbor) };
  }

  // One box from the web door under the shell's number for the call, its
  // reply, and whether it is asked again. A call that lands in a spent
  // child is asked again untouched.
  async arrive(pk: string, box: Uint8Array, call: number): Promise<Arrived> {
    const harbor = await this.#opening;
    if (!harbor) return { reply: null, wanted: null, again: false };
    if (this.#loader.missing) return { reply: null, wanted: await this.#wanted(harbor), again: true };
    const reply = await this.#calls.run(call, () => harbor.arrive(pk, box)).catch(() => null);
    return { reply, wanted: await this.#wanted(harbor), again: this.#calls.again(call) };
  }

  async #wanted(harbor: Harbor): Promise<Wanted | null> {
    const missed = this.#loader.missed();
    const catalogue = async (method: string): Promise<JsonObject> => ((await harbor.ask({ method: 'ask', args: { being: 'catalogue', method } })).answer as { answer: JsonObject }).answer;
    const live = (await catalogue('live')).live as string;
    if (missed.size === 0 && live === this.#settled) return null;
    const sources = (await catalogue('sources')).sources as { blob: string; source: string }[];
    const modules = new Map(sources.map((s) => [s.blob, s.source]));
    for (const [blob, source] of missed) modules.set(blob, source);
    for (const blob of this.#loader.refused.keys()) modules.delete(blob);
    const liveBlobs = sources.map((s) => s.blob);
    if (missed.size === 0 && childKey(live, [...modules.keys()], liveBlobs) === this.#key) {
      this.#settled = live;
      return null;
    }
    return { live, liveBlobs, modules: Object.fromEntries(modules), missed: [...missed.keys()] };
  }
}

// The Worker Loader binding, and a child's facet, as the shell uses them.
type WorkerCode = { readonly compatibilityDate: string; readonly compatibilityFlags?: readonly string[]; readonly mainModule: string; readonly modules: Record<string, { js: string }>; readonly env: Record<string, unknown> };
type LoadedWorker = { getDurableObjectClass(name: string): unknown; getEntrypoint(): { fetch(request: Request): Promise<Response> } };
export type WorkerLoader = { get(id: string, code: () => Promise<WorkerCode>): LoadedWorker };
type ChildStub = {
  open(name: string, host: string, port: number, packed: Packed | null, refused: Record<string, string>): Promise<Opened>;
  arrive(pk: string, box: Uint8Array, call: number): Promise<Arrived>;
};
type Facets = { get(name: string, start: () => Promise<{ class: unknown }>): ChildStub; abort(name: string, reason: unknown): void };
export type ShellState = { readonly facets: Facets };
export type ShellEnv = EdgeEnv & { readonly LOADER?: WorkerLoader };

const FACET = 'harbor';
const CHILD = 'Harbor';
const MAIN = 'harbor.js';
const PROBE = 'probe.js';
const BOOT = 'boot';
const COMPATIBILITY = '2026-09-01';
// The most moves one call makes before the shell gives up on it.
const ROUNDS = 8;
// A module's file at the child's root, where its `'nervur'` names the kit.
const moduleFile = (blob: string): string => `${blob}.js`;

// A child's main module: the kit's child as the facet's class, over the
// modules it carries, each imported by its blob's file.
const childMain = (key: string, blobs: readonly string[]): string =>
  [
    "import { DurableObject } from 'cloudflare:workers';",
    "import { AsyncLocalStorage } from 'node:async_hooks';",
    "import { HarborChild } from 'nervur';",
    ...blobs.map((b, i) => `import * as m${String(i)} from '${moduleFile(b)}';`),
    `const carried = [${blobs.map((b, i) => `{ blob: '${b}', module: m${String(i)} }`).join(', ')}];`,
    'export class Harbor extends DurableObject {',
    `  #child = new HarborChild(this.ctx, this.env, ${JSON.stringify(key)}, carried, new AsyncLocalStorage());`,
    '  open(name, host, port, packed, refused) { return this.#child.open(name, host, port, packed, refused); }',
    '  arrive(pk, box, call) { return this.#child.arrive(pk, box, call); }',
    '}',
    '',
  ].join('\n');

// A probe's main module: the module alone beside the kit, so one that
// does not load fails here and never in a harbor's child.
const probeMain = (blob: string): string => `import '${moduleFile(blob)}';\nexport default { fetch() { return new Response(null, { status: 204 }); } };\n`;

const said = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// What a Durable Object class of harbors is made of:
//
//   kit    the kit as one module's text, `nervur/edge/kit`, which every
//          child runs and every module's `'nervur'` names
//   pack   the harbors carried here, from `nervur edge pack`, each landed
//          the first time its child starts; or a function of the
//          worker's environment giving them
export type HarborShellParts = {
  readonly kit: string;
  readonly pack: Pack | ((env: EdgeEnv) => Pack | undefined);
};
export type HarborShell = { fetch(request: Request): Promise<Response> };
export type HarborShellClass = new (state: ShellState, env: ShellEnv) => HarborShell;

// A Durable Object class whose every instance is one harbor, by the name
// the worker reached it under, the one its pack holds under that name. The
// object is a shell: it keeps the harbor's storage as its child's facet,
// answers the web at `/<name>/quo`, and hands each box to the child it
// loaded for the commit `live` names. A call that misses a module loads
// the next child carrying it and is asked there again, since a miss comes
// before `live` or any cell moves; a module that does not load on its own
// is refused with its reason, and `live` stays. An object answers the one
// name it opened under, and a name its pack does not hold is 404, with
// nothing written. The shell never runs a harbor's code and reads no cell.
export const harborShell = ({ kit, pack }: HarborShellParts): HarborShellClass =>
  class implements HarborShell {
    readonly #state: ShellState;
    readonly #env: ShellEnv;
    readonly #refused: Record<string, string> = {};
    #name: string | undefined;
    #packed: Packed | undefined;
    #at: { host: string; port: number } | undefined;
    #kit: Promise<string> | undefined;
    #key: string | undefined;
    #child: ChildStub | undefined;
    #listen: WebListen | null = null;
    #standing: Promise<void> | undefined;
    #turn: Promise<unknown> = Promise.resolve();
    // The number the shell gives each call it hands a child.
    #calls = 0;
    // The calls inside the child now, and the moves waiting for them to end.
    #inside = 0;
    #ended: (() => void)[] = [];
    // Where the child said the shell must go, the latest word of the child
    // that stands.
    #wanted: Wanted | undefined;

    constructor(state: ShellState, env: ShellEnv) {
      this.#state = state;
      this.#env = env;
    }

    async fetch(request: Request): Promise<Response> {
      const name = harborNameOf(request);
      if (name === null || (this.#name !== undefined && this.#name !== name)) return new Response(null, { status: 404 });
      if (this.#name === undefined) {
        const packed = typeof pack === 'function' ? pack(this.#env) : pack;
        const held = packed && Object.hasOwn(packed, name) ? packed[name] : undefined;
        if (!held) return new Response(null, { status: 404 });
        const url = new URL(request.url);
        this.#name = name;
        this.#packed = held;
        this.#at = { host: url.hostname, port: url.port === '' ? 0 : Number(url.port) };
      }
      this.#standing ??= this.#serial(() => this.#open(BOOT, {}, 0)).catch((e: unknown) => {
        this.#standing = undefined;
        throw e;
      });
      await this.#standing;
      const listen = this.#listen;
      if (!listen) return new Response(null, { status: 404 });
      const door: Arrivals = { arrive: (pk, box) => this.#arrive(pk, box) };
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return answerPost(door, listen, request);
      const offered = (request.headers.get('sec-websocket-protocol') ?? '').split(',').map((p) => p.trim());
      if (new URL(request.url).pathname !== listen.path || !offered.includes('quo')) return new Response(null, { status: 400 });
      const Pair = (globalThis as unknown as { WebSocketPair: new () => EdgePair }).WebSocketPair;
      const pair = new Pair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();
      const side = { send: (body: Uint8Array) => server.send(new Uint8Array(body)), close: () => server.close() };
      server.addEventListener('message', (event: MessageEvent) => answerHeld(door, side, typeof event.data === 'string' ? event.data : new Uint8Array(event.data as ArrayBuffer)));
      return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': 'quo' } } as ResponseInit);
    }

    // One move at a time.
    #serial<T>(work: () => Promise<T>): Promise<T> {
      const run = this.#turn.then(work, work);
      this.#turn = run.catch(() => undefined);
      return run;
    }

    #loader(): WorkerLoader {
      const loader = this.#env.LOADER;
      if (!loader) throw new Error('the worker binds no LOADER: its wrangler.toml names a worker_loaders binding');
      return loader;
    }

    #kitId(): Promise<string> {
      return (this.#kit ??= sha256(utf8(kit)).then((digest) => hex(digest).slice(0, 16)));
    }

    // The child under `key`, carrying `modules`, stood as the facet in the
    // one before's place, and opened. A staging child carries a blob a
    // call missed beside what `live` names, and keeps its key until that
    // call, asked again, moves `live`.
    async #open(key: string, modules: Readonly<Record<string, string>>, depth: number, staging = false): Promise<void> {
      const id = `${await this.#kitId()}:${key}`;
      const blobs = Object.keys(modules).sort();
      const secret = this.#env.NERVUR_SECRET;
      const code: WorkerCode = {
        compatibilityDate: COMPATIBILITY,
        // `AsyncLocalStorage` alone of Node's modules, to tell calls apart.
        compatibilityFlags: ['nodejs_als'],
        mainModule: MAIN,
        modules: { [MAIN]: { js: childMain(key, blobs) }, nervur: { js: kit }, ...Object.fromEntries(blobs.map((b) => [moduleFile(b), { js: modules[b]! }])) },
        env: secret === undefined ? {} : { NERVUR_SECRET: secret },
      };
      const worker = this.#loader().get(id, () => Promise.resolve(code));
      if (this.#child) this.#state.facets.abort(FACET, new Error('live moved'));
      const child = this.#state.facets.get(FACET, () => Promise.resolve({ class: worker.getDurableObjectClass(CHILD) }));
      this.#child = child;
      this.#key = key;
      this.#wanted = undefined;
      const opened = await child.open(this.#name!, this.#at!.host, this.#at!.port, this.#packed ?? null, { ...this.#refused });
      this.#listen = opened.listen;
      if (opened.wanted && (!staging || opened.wanted.missed.length > 0)) await this.#move(opened.wanted, depth + 1);
    }

    // Where a child said the shell must go: each blob it missed probed, one
    // that does not load refused, and the child for what remains loaded.
    // A call that missed kept nothing, so a fresh child takes it whole,
    // under the same key where every blob it missed is refused.
    async #move(wanted: Wanted, depth: number): Promise<void> {
      if (depth > ROUNDS) throw new Error('the harbor settles on no child');
      for (const blob of wanted.missed) {
        if (Object.hasOwn(this.#refused, blob)) continue;
        const reason = await this.#probe(blob, wanted.modules[blob] ?? '');
        if (reason !== null) this.#refused[blob] = reason;
      }
      const modules = Object.fromEntries(Object.entries(wanted.modules).filter(([blob]) => !Object.hasOwn(this.#refused, blob)));
      const key = childKey(wanted.live, Object.keys(modules), wanted.liveBlobs);
      const staging = wanted.missed.length > 0;
      if (key === this.#key && !staging) return;
      return this.#open(key, modules, depth, staging);
    }

    // Null where a module loads on its own beside the kit, and else why not.
    async #probe(blob: string, source: string): Promise<string | null> {
      const code: WorkerCode = {
        compatibilityDate: COMPATIBILITY,
        mainModule: PROBE,
        modules: { [PROBE]: { js: probeMain(blob) }, nervur: { js: kit }, [moduleFile(blob)]: { js: source } },
        env: {},
      };
      try {
        const worker = this.#loader().get(`${await this.#kitId()}:probe:${blob}`, () => Promise.resolve(code));
        const answered = await worker.getEntrypoint().fetch(new Request('https://probe.invalid/'));
        return answered.status === 204 ? null : `the module does not load on the edge: ${await answered.text()}`;
      } catch (e) {
        return `the module does not load on the edge: ${said(e)}`;
      }
    }

    // A box handed to the child, and its answer. Where the child says the
    // shell must move, the move waits until no call is inside, so none is
    // cut short, and no call enters while it waits. A call that missed a
    // module told nothing, and is asked again in the next child.
    async #arrive(pk: string, box: Uint8Array): Promise<Uint8Array | null> {
      for (let round = 0; round <= ROUNDS; round += 1) {
        let turn: Promise<unknown>;
        do {
          turn = this.#turn;
          await turn;
        } while (turn !== this.#turn);
        const child = this.#child!;
        const call = (this.#calls += 1);
        this.#inside += 1;
        let arrived: Arrived | null;
        try {
          arrived = await child.arrive(pk, box, call);
        } catch {
          arrived = null;
        } finally {
          this.#inside -= 1;
          if (this.#inside === 0) for (const end of this.#ended.splice(0)) end();
        }
        if (arrived === null) return null;
        if (arrived.wanted && child === this.#child) {
          this.#wanted = arrived.wanted;
          void this.#serial(() => this.#moved(child)).catch(() => undefined);
        }
        if (!arrived.again) return arrived.reply;
      }
      return null;
    }

    // The move the child that stands asked for, once no call is inside it.
    async #moved(child: ChildStub): Promise<void> {
      if (this.#inside > 0) await new Promise<void>((end) => this.#ended.push(end));
      const wanted = this.#wanted;
      if (child !== this.#child || !wanted) return;
      this.#wanted = undefined;
      await this.#move(wanted, 0);
    }
  };

// What a worker hands a WebSocket upgrade.
type EdgePair = { 0: EdgeWebSocket; 1: EdgeWebSocket };
type EdgeWebSocket = WebSocket & { accept(): void };

type Namespace = { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } };

// A worker of many harbors: each request goes to the object of the
// harbor its path names, in the Durable Object namespace bound as
// `binding`, and a path naming none is 404.
export const harborWorker = (binding = 'HARBOR') => ({
  fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    const name = harborNameOf(request);
    const objects = env[binding] as Namespace | undefined;
    if (name === null || !objects) return Promise.resolve(new Response(null, { status: 404 }));
    return objects.get(objects.idFromName(name)).fetch(request);
  },
});
