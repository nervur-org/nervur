// SPDX-License-Identifier: Apache-2.0
// The pointer terrain's bodies: each contract fulfilled in one process,
// with nothing beyond JavaScript.
import { Clock, Custody, Entropy, linked, Loader, Memory, moduleOf, type Bundled, type Module } from '../contract/index.ts';
import { blob, idOf } from '../git/index.ts';

export class CryptoEntropy extends Entropy {
  draw(length: number): Uint8Array {
    return globalThis.crypto.getRandomValues(new Uint8Array(length));
  }
}

export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
  wait(ms: number): { done: Promise<void>; cancel(): void } {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)));
    return { done, cancel: () => clearTimeout(timer) };
  }
}

// The harbor's seed, drawn once and held by this object.
export class HeldCustody extends Custody {
  readonly #seed: Uint8Array;
  constructor(entropy: Entropy) {
    super();
    this.#seed = entropy.draw(32);
  }
  seed(): Promise<Uint8Array> {
    return Promise.resolve(this.#seed.slice());
  }
}

// How this engine imports a module it is handed as text: from a Blob URL
// where it imports one, as a browser, Deno and Bun do, and else from a
// data: URL, as Node does. Bun reads a data: URL as a module that exports
// nothing, so the Blob URL is tried first, once, with a module of one
// export.
type Importer = (text: string) => Promise<unknown>;
const fromBlob: Importer = async (text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};
const fromData: Importer = (text) => import(`data:text/javascript;charset=utf-8,${encodeURIComponent(text)}`);
let importer: Promise<Importer> | undefined;
const importerHere = (): Promise<Importer> =>
  (importer ??= fromBlob('export const probe = 1;').then(
    (m) => ((m as { probe?: unknown }).probe === 1 ? fromBlob : fromData),
    () => fromData,
  ));

// A module's source run by the engine's own `import()`, its `'nervur'`
// linked to the kit running: Node, Deno, Bun, a browser's page and shared
// worker, and every engine that imports what it is handed.
export class SourceLoader extends Loader {
  async load(source: string): Promise<Module> {
    const text = linked(source);
    let exported: unknown;
    try {
      exported = await (await importerHere())(text);
    } catch (e) {
      throw new Error(`the module did not load: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    return moduleOf(exported);
  }
}

// The modules a bundle carries, found by content alone: the git id of a
// source's blob names the module built from it. An edge evaluates no code
// it is handed, so a source whose blob the bundle does not carry needs a
// deploy that carries it.
export class BundleLoader extends Loader {
  readonly #bundle: readonly Bundled[];
  #ids: Promise<Map<string, Module>> | undefined;
  constructor(bundle: readonly Bundled[] = []) {
    super();
    this.#bundle = bundle;
  }
  async load(_source: string, id: string): Promise<Module> {
    this.#ids ??= Promise.all(this.#bundle.map(async (b): Promise<[string, Module]> => [await idOf(blob(b.source)), b.module])).then((ids) => new Map(ids));
    const found = (await this.#ids).get(id);
    if (found) return moduleOf(found);
    const carried = this.#bundle.map((b) => b.module.module);
    throw new Error(`redeploy needed: blob ${id} is no module this bundle carries${carried.length === 0 ? ', and it carries none' : `: it carries ${carried.join(', ')}`}`);
  }
}

// Entries that live as long as this object, copied in and out, which is
// what a restart in one process finds.
export class VolatileMemory extends Memory {
  readonly #places = new Map<string, Map<string, Uint8Array>>();
  read(place: string): Promise<Map<string, Uint8Array>> {
    const entries = this.#places.get(place) ?? new Map<string, Uint8Array>();
    return Promise.resolve(new Map([...entries].map(([name, bytes]) => [name, bytes.slice()])));
  }
  // One object holds it, so a keep is whole by the run of one turn.
  write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    let kept = this.#places.get(place);
    if (!kept) this.#places.set(place, (kept = new Map()));
    for (const [name, bytes] of entries) {
      if (bytes === null) kept.delete(name);
      else kept.set(name, bytes.slice());
    }
    if (kept.size === 0) this.#places.delete(place);
    return Promise.resolve();
  }

  places(): Promise<string[]> {
    return Promise.resolve([...this.#places.keys()]);
  }

  forget(place: string): Promise<void> {
    this.#places.delete(place);
    return Promise.resolve();
  }
}
