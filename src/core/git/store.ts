// SPDX-License-Identifier: Apache-2.0
// Where objects are kept, and what a repository reads out of them: the
// files a commit holds, a tree written from files, and every object a
// commit reaches.
import { commit, DIRECTORY, FILE, idOf, readCommit, readTree, tree, type Commit, type GitObject } from './object.ts';

export interface ObjectStore {
  get(id: string): Promise<GitObject | null>;
  // Every object kept, and their ids in the same order.
  put(objects: readonly GitObject[]): Promise<string[]>;
}

// An object the store must hold, of the type named.
export const need = async (store: ObjectStore, id: string, type: GitObject['type']): Promise<GitObject> => {
  const o = await store.get(id);
  if (!o) throw new Error(`${id} is no object this harbor holds`);
  if (o.type !== type) throw new Error(`${id} is a ${o.type}, not a ${type}`);
  return o;
};

// Every file of a commit's tree, by its path, with its blob's id.
export const files = async (store: ObjectStore, id: string): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  const walk = async (treeId: string, at: string): Promise<void> => {
    for (const e of readTree(await need(store, treeId, 'tree'))) {
      if (e.mode === DIRECTORY) await walk(e.id, `${at}${e.name}/`);
      else out.set(`${at}${e.name}`, e.id);
    }
  };
  await walk(readCommit(await need(store, id, 'commit')).tree, '');
  return out;
};

// Files by path, each a blob's id, written as trees; the root's id.
export const writeTree = async (store: ObjectStore, paths: ReadonlyMap<string, string>): Promise<string> => {
  const level = async (under: ReadonlyMap<string, string>): Promise<string> => {
    const entries: { mode: string; name: string; id: string }[] = [];
    const dirs = new Map<string, Map<string, string>>();
    for (const [path, id] of under) {
      const slash = path.indexOf('/');
      if (slash < 0) entries.push({ mode: FILE, name: path, id });
      else {
        const name = path.slice(0, slash);
        if (!dirs.has(name)) dirs.set(name, new Map());
        dirs.get(name)!.set(path.slice(slash + 1), id);
      }
    }
    for (const [name, inner] of dirs) entries.push({ mode: DIRECTORY, name, id: await level(inner) });
    const [id] = await store.put([tree(entries)]);
    return id!;
  };
  return level(paths);
};

export const writeCommit = async (store: ObjectStore, c: Commit): Promise<string> => {
  const [id] = await store.put([commit(c)]);
  return id!;
};

// Every object a commit reaches, itself first: its ancestors, their trees
// and every blob.
export const reachable = async (store: ObjectStore, from: string): Promise<string[]> => {
  const seen = new Set<string>();
  const walkTree = async (id: string): Promise<void> => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const e of readTree(await need(store, id, 'tree'))) {
      if (e.mode === DIRECTORY) await walkTree(e.id);
      else seen.add(e.id);
    }
  };
  const commits = [from];
  while (commits.length > 0) {
    const id = commits.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const c = readCommit(await need(store, id, 'commit'));
    await walkTree(c.tree);
    commits.push(...c.parents);
  }
  return [...seen];
};

// Objects held in this process alone.
export class HeldObjects implements ObjectStore {
  readonly #objects = new Map<string, GitObject>();
  // Every object held, in the order first put.
  objects(): GitObject[] {
    return [...this.#objects.values()];
  }
  get(id: string): Promise<GitObject | null> {
    return Promise.resolve(this.#objects.get(id) ?? null);
  }
  async put(objects: readonly GitObject[]): Promise<string[]> {
    const ids: string[] = [];
    for (const o of objects) {
      const id = await idOf(o);
      this.#objects.set(id, o);
      ids.push(id);
    }
    return ids;
  }
}

// Objects written over a store and kept aside until `flush` puts them in
// it: what a store reads through, and what it writes nowhere yet.
export class StagedObjects implements ObjectStore {
  readonly #under: ObjectStore;
  readonly #staged = new HeldObjects();
  constructor(under: ObjectStore) {
    this.#under = under;
  }
  async get(id: string): Promise<GitObject | null> {
    return (await this.#staged.get(id)) ?? this.#under.get(id);
  }
  put(objects: readonly GitObject[]): Promise<string[]> {
    return this.#staged.put(objects);
  }
  async flush(): Promise<void> {
    await this.#under.put(this.#staged.objects());
  }
}
