// SPDX-License-Identifier: Apache-2.0
// The catalogue: the core's registry, the harbor's DNA. She keeps its
// code as a git repository, from genesis, its objects in the root memory
// under her own places and never in a cell. Her cells keep `live`, the
// commit that stands, `origin`, where she fetches from, and `refs`, what
// she fetched last. A commit holds one file per module,
// `modules/<module id>.js`, and nothing else is read from it.
//
//   add     { source, name? }   the module's source committed on `live`,
//                               and `live` moved to it
//   remove  { module }          its file committed away, and `live` moved,
//                               refused while a being stands on its kinds
//   live    { commit? }         `live` moved to a commit or a fetched ref,
//                               or, with none, the commit that stands
//   log     { commit? }         the commits from `live` back, first
//                               parents alone
//   origin  { url }             where `fetch` reads, or null
//   fetch                       every ref of `origin` and all it reaches,
//                               kept, and the refs
//   gc                          every object that neither `live` nor a
//                               fetched ref reaches, forgotten
//   modules                     what `live` runs, and why a module does not
//   sources                     `live`, and the source of each module
//                               file it holds, by its blob
//
// She resolves a kind to a class from the kit and the modules `live`
// runs, and nothing else does it for her: the harbor stands her before any
// registry, from the core alone. Moving `live` checks the commit's modules
// out, hands each to the terrain's loader and indexes them all: a set that
// does not run together is refused with its reason, and `live` stays. Once
// it runs, every being a new class resolves is born again on her stance,
// and what stands on what now resolves stands. A
// wake stands `live` again from the objects kept, with no network, and
// there a module that does not load, or splits a kind with one before it,
// stays out alone with its reason, and the beings of its kinds stand
// absent. At genesis `live` is an empty commit.
//
// What `add` and `remove` commit is staged aside and written to the DNA
// only once the commit checks, so a refused one leaves no object. `gc`
// takes its turn with every ask that writes the DNA, keeps her cells
// first, and forgets only what the kept `live` and refs do not reach, so
// a cut mid-collection loses nothing a restart stands.
//
// She is the core's, of kind `org.nervur.catalogue`, answers the root and an
// owner alone, and is born of her stance alone, whose `ground` is her
// harbor.
import { ships, type AskSpec, type BeingClass, type JsonObject, type Stance } from '../being/index.ts';
import type { Module } from '../contract/index.ts';
import { blob, fetchPack, files, havesFrom, isId, listRefs, reachable, readCommit, StagedObjects, text, tree, writeCommit, writeTree, type ObjectStore, type Signature } from '../git/index.ts';
import { ownerAsk } from '../ward/index.ts';
import { Registry, RegistryFaculty } from './registry.ts';
import type { Terrain } from './terrain.ts';

export const CATALOGUE = 'catalogue';

const DIR = 'modules/';
const SUFFIX = '.js';
const pathOf = (module: string): string => `${DIR}${module}${SUFFIX}`;
const WHO = { name: 'nervur', email: 'catalogue@nervur.org' };

// What the catalogue asks of her harbor.
export interface Cataloguing {
  readonly terrain: Terrain;
  readonly dna: ObjectStore & {
    // Every object but those named forgotten, and how many were.
    collect(keep: Iterable<string>): Promise<number>;
  };
  // The kit's own classes, which alone may be of its kinds.
  readonly kit: readonly BeingClass[];
  // Once `live` moved and runs: every being whose class moved is born
  // again, and what stands on what now resolves stands.
  ran(): Promise<void>;
  // Whether a being of any ward stands on one of these kinds.
  stands(kinds: readonly string[]): boolean;
  // Every kind a row of any ward keeps.
  kept(): string[];
  keep(): Promise<boolean>;
}

type Running = { module: Module; blob: string };

const isText = (v: unknown): v is string => typeof v === 'string';
const domainOf = (name: string): string => `${name.split('.').slice(0, 2).join('.')}.`;
const failure = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export class Catalogue extends RegistryFaculty {
  static override readonly kind: string = 'org.nervur.catalogue';
  static {
    ships(this);
  }
  static override asks: Record<string, AskSpec> = {
    add: ownerAsk('a module committed on live, and live moved to it', { required: ['source'] }),
    remove: ownerAsk('a module committed away, and live moved', { required: ['module'] }),
    live: ownerAsk('live moved to a commit, or the commit that stands'),
    log: ownerAsk('the commits from live back'),
    origin: ownerAsk('where fetch reads', { required: ['url'] }),
    fetch: ownerAsk('every ref of origin and all it reaches, kept'),
    modules: ownerAsk('the modules live runs'),
    sources: ownerAsk('the source of each module file live holds, by its blob'),
    gc: ownerAsk('every object neither live nor a fetched ref reaches, forgotten'),
  };

  readonly #harbor: Cataloguing;
  // Every kind the kit and what `live` runs bring.
  #registry: Registry;
  // What `live` runs, by module, and why a module it holds does not.
  #running = new Map<string, Running>();
  #failed = new Map<string, { blob: string; reason: string }>();
  // Why `live` itself did not check out at wake, where it did not.
  #fault: string | null = null;
  // The asks that write the DNA, one after another.
  #turn: Promise<unknown> = Promise.resolve();

  constructor(stance: Stance) {
    super(stance);
    const { ground } = stance as Stance & { ground?: Cataloguing };
    if (!ground) throw new Error('the catalogue stands in the box ward alone');
    this.#harbor = ground;
    this.#registry = new Registry(ground.kit, []);
  }

  classOf(kind: string): BeingClass | undefined {
    return this.#registry.classOf(kind);
  }

  // Why these modules cannot run together, or null.
  #check(modules: readonly Module[]): string | null {
    return Registry.refusal(this.#harbor.kit, modules);
  }

  get #live(): string | undefined {
    return isId(this.cells.live) ? this.cells.live : undefined;
  }

  get #refs(): Record<string, string> {
    return (this.cells.refs ?? {}) as Record<string, string>;
  }

  #signature(): Signature {
    return { ...WHO, seconds: Math.floor(this.#harbor.terrain.clock.now() / 1000), zone: '+0000' };
  }

  // One ask that writes the DNA at a time, in the order asked.
  #serial<T>(work: () => Promise<T>): Promise<T> {
    const done = this.#turn.then(work, work);
    this.#turn = done.catch(() => undefined);
    return done;
  }

  async #commit(dna: ObjectStore, paths: ReadonlyMap<string, string>, message: string): Promise<string> {
    const root = paths.size === 0 ? (await dna.put([tree([])]))[0]! : await writeTree(dna, paths);
    const who = this.#signature();
    return writeCommit(dna, { tree: root, parents: this.#live ? [this.#live] : [], author: who, committer: who, message: `${message}\n` });
  }

  // Each module file of a commit, in the tree's order, its source loaded.
  async #checkout(commit: string, dna: ObjectStore = this.#harbor.dna): Promise<{ name: string; blob: string; loaded: Module | Error }[]> {
    const out: { name: string; blob: string; loaded: Module | Error }[] = [];
    for (const [path, id] of await files(dna, commit)) {
      if (!path.startsWith(DIR) || !path.endsWith(SUFFIX) || path.slice(DIR.length).includes('/')) continue;
      const name = path.slice(DIR.length, -SUFFIX.length);
      let loaded: Module | Error;
      try {
        const o = await dna.get(id);
        if (!o) throw new Error(`blob ${id} is not kept`);
        loaded = await this.#harbor.terrain.loader.load(text(o.body), id);
        if (loaded.module !== name) throw new Error(`${path} declares module ${loaded.module}`);
      } catch (e) {
        loaded = e instanceof Error ? e : new Error(String(e));
      }
      out.push({ name, blob: id, loaded });
    }
    return out;
  }

  // `live` stood again, as a wake finds it: a genesis commit on empty
  // memory, and every module that loads and splits no kind with those
  // before it run; the rest stay out, each with its reason.
  async wake(): Promise<void> {
    if (!this.#live) {
      this.cells.live = await this.#commit(this.#harbor.dna, new Map(), 'genesis');
      await this.#harbor.keep();
    }
    const running = new Map<string, Running>();
    try {
      for (const { name, blob: id, loaded } of await this.#checkout(this.#live!)) {
        const refused = loaded instanceof Error ? loaded.message : this.#check([...[...running.values()].map((r) => r.module), loaded]);
        if (refused === null) running.set(name, { module: loaded as Module, blob: id });
        else this.#failed.set(name, { blob: id, reason: refused });
      }
    } catch (e) {
      this.#fault = failure(e);
    }
    this.#running = running;
    this.#registry = new Registry(this.#harbor.kit, [...running.values()].map((r) => r.module));
  }

  // `live` moved to a commit whose every module loads and runs with the
  // rest, or the reason it stays. A commit staged is written to the DNA
  // once it checks, before it runs and before `live` names it.
  async #move(commit: string, staged?: StagedObjects): Promise<string | null> {
    let checked: { name: string; blob: string; loaded: Module | Error }[];
    try {
      checked = await this.#checkout(commit, staged);
    } catch (e) {
      return failure(e);
    }
    const bad = checked.find((c) => c.loaded instanceof Error);
    if (bad) return `${bad.name}: ${(bad.loaded as Error).message}`;
    const modules = checked.map((c) => c.loaded as Module);
    const unfit = this.#check(modules);
    if (unfit !== null) return unfit;
    await staged?.flush();
    this.#registry = new Registry(this.#harbor.kit, modules);
    this.#running = new Map(checked.map((c) => [c.name, { module: c.loaded as Module, blob: c.blob }]));
    this.#failed = new Map();
    this.#fault = null;
    this.cells.live = commit;
    await this.#harbor.ran();
    return null;
  }

  async #paths(): Promise<Map<string, string>> {
    return this.#live ? files(this.#harbor.dna, this.#live) : new Map();
  }

  add(args: JsonObject): Promise<JsonObject> {
    return this.#serial(() => this.#add(args));
  }

  async #add(args: JsonObject): Promise<JsonObject> {
    if (!isText(args.source)) return { error: 'source is text' };
    if (args.name !== undefined && !isText(args.name)) return { error: 'name is text' };
    const staged = new StagedObjects(this.#harbor.dna);
    const [id] = await staged.put([blob(args.source)]);
    let loaded: Module;
    try {
      loaded = await this.#harbor.terrain.loader.load(args.source, id!);
    } catch (e) {
      return { error: failure(e) };
    }
    if (args.name !== undefined && args.name !== loaded.module) return { error: `the source is module ${loaded.module}, not ${args.name}` };
    const paths = await this.#paths();
    paths.set(pathOf(loaded.module), id!);
    const commit = await this.#commit(staged, paths, `add ${loaded.module} ${loaded.version}`);
    const refused = await this.#move(commit, staged);
    if (refused !== null) return { error: refused };
    return { added: loaded.module, version: loaded.version, live: commit };
  }

  remove(args: JsonObject): Promise<JsonObject> {
    return this.#serial(() => this.#remove(args));
  }

  async #remove(args: JsonObject): Promise<JsonObject> {
    const module = args.module;
    const paths = await this.#paths();
    if (!isText(module) || !paths.has(pathOf(module))) return { error: 'no such module' };
    if (this.#harbor.stands(this.#kindsOf(module))) return { error: 'a being stands on this module' };
    paths.delete(pathOf(module));
    const staged = new StagedObjects(this.#harbor.dna);
    const commit = await this.#commit(staged, paths, `remove ${module}`);
    const refused = await this.#move(commit, staged);
    if (refused !== null) return { error: refused };
    return { removed: module, live: commit };
  }

  // The kinds a module stands: the registry's, where it runs, and where it
  // does not, every kind a row keeps in its domain that nothing resolves.
  #kindsOf(module: string): string[] {
    if (this.#running.has(module)) return this.#registry.kindsOf(module);
    const domain = domainOf(module);
    return this.#harbor.kept().filter((kind) => kind.startsWith(domain) && this.#registry.classOf(kind) === undefined);
  }

  live(args: JsonObject): Promise<JsonObject> {
    if (args.commit === undefined) return Promise.resolve({ live: this.#live ?? null });
    return this.#serial(() => this.#goLive(args));
  }

  async #goLive(args: JsonObject): Promise<JsonObject> {
    const named = args.commit;
    const commit = isText(named) && Object.hasOwn(this.#refs, named) ? this.#refs[named]! : named;
    if (!isId(commit)) return { error: 'commit is a commit id or a fetched ref' };
    const refused = await this.#move(commit);
    return refused === null ? { live: commit } : { error: refused };
  }

  async log(args: JsonObject): Promise<JsonObject> {
    const from = args.commit ?? this.#live;
    if (!isId(from)) return { error: 'commit is a commit id' };
    const log: JsonObject[] = [];
    try {
      for (let at: string | undefined = from; at !== undefined; ) {
        const o = await this.#harbor.dna.get(at);
        if (!o) break;
        const c = readCommit(o);
        log.push({ commit: at, parents: [...c.parents], message: c.message.replace(/\n$/, ''), seconds: c.committer.seconds });
        at = c.parents[0];
      }
    } catch (e) {
      return { error: failure(e) };
    }
    return { log };
  }

  origin(args: JsonObject): JsonObject {
    const url = args.url;
    if (url === null) {
      delete this.cells.origin;
      return { origin: null };
    }
    if (!isText(url) || !/^https?:\/\/[^/\s]+/.test(url)) return { error: 'url is an http or https URL, or null' };
    this.cells.origin = url;
    return { origin: url };
  }

  // Read-only on the remote: its refs, and a pack of what they reach that
  // is not kept here, each object kept. The commits `live` and the refs
  // reach are its haves, so the pack carries only what is new.
  fetch(): Promise<JsonObject> {
    return this.#serial(() => this.#fetch());
  }

  async #fetch(): Promise<JsonObject> {
    const url = this.cells.origin;
    if (!isText(url)) return { error: 'no origin is set' };
    try {
      const refs = await listRefs(url);
      const held = (id: string): ReturnType<ObjectStore['get']> => this.#harbor.dna.get(id);
      const objects = await fetchPack(url, Object.values(refs), held, await havesFrom(this.#roots(), held));
      await this.#harbor.dna.put([...objects.values()]);
      this.cells.refs = refs;
      return { refs, objects: objects.size };
    } catch (e) {
      return { error: failure(e) };
    }
  }

  // What the DNA keeps history from: `live` and every fetched ref.
  #roots(): string[] {
    return [...new Set([...(this.#live ? [this.#live] : []), ...Object.values(this.#refs)])];
  }

  // What `live` and every fetched ref reach stays, and the rest of the
  // DNA is forgotten. Her cells are kept first, so she collects against
  // what a restart stands; the whole reachable set is known before any
  // object goes, and an object missing from it stops the collection.
  gc(): Promise<JsonObject> {
    return this.#serial(async (): Promise<JsonObject> => {
      if (!(await this.#harbor.keep())) throw new Error('her cells were not kept');
      const dna = this.#harbor.dna;
      const keep = new Set<string>();
      for (const root of this.#roots()) {
        // An annotated tag is kept, and the commit it names walked; a
        // missing object throws here, before anything is forgotten.
        let at = root;
        for (let o = await dna.get(at); o?.type === 'tag'; o = await dna.get(at)) {
          keep.add(at);
          at = /^object ([0-9a-f]{40})$/m.exec(text(o.body))?.[1] ?? '';
        }
        for (const id of await reachable(dna, at)) keep.add(id);
      }
      return { collected: await dna.collect(keep), kept: keep.size };
    });
  }

  // Each module file `live` holds, by its blob's id, with its source: what
  // an edge's next child carries.
  async sources(): Promise<JsonObject> {
    const sources: JsonObject[] = [];
    for (const [path, id] of await this.#paths()) {
      if (!path.startsWith(DIR) || !path.endsWith(SUFFIX)) continue;
      const o = await this.#harbor.dna.get(id);
      if (o) sources.push({ blob: id, source: text(o.body) });
    }
    return { live: this.#live ?? null, sources };
  }

  modules(): JsonObject {
    const modules: JsonObject = {};
    for (const [name, r] of this.#running) modules[name] = { running: r.module.version, blob: r.blob };
    for (const [name, f] of this.#failed) modules[name] = { running: null, blob: f.blob, failed: f.reason };
    return { live: this.#live ?? null, modules, ...(this.#fault === null ? {} : { failed: this.#fault }) };
  }
}
