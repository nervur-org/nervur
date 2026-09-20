// SPDX-License-Identifier: Apache-2.0
// A harbor on a disk, for local proof: `nervur/folder`, an entry that
// names a platform.
//
//   <root>/seed              the harbor's seed, as hex
//   <root>/<place>/<entry>   one sealed entry of the harbor's memory
//   <root>/<place>/keep      a keep of that place, until it is applied
//
// Places and entries are the hex names the kit chose, so no name reaches
// outside its folder, and the disk shows no ward's name. A file is written
// whole, beside itself and then renamed over.
//
// A keep is whole, by its own file: the whole keep is written under `keep`
// and renamed over, then its entries are written and removed one by one,
// then `keep` goes. A read applies a `keep` it finds first, and the same
// bytes written twice leave the same place, so a keep that a crash cut
// short finishes at the next read. A place read before its `keep` landed
// has none of it. `keep` is no hex name, so it is never an entry.
//
// The seed is a plain file: custody that seals it is a terrain's.
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hex, isHex, unhex } from '../crypto/index.ts';
import { Custody, Memory, type Entropy } from '../contract/index.ts';

const missing = (e: unknown): boolean => (e as { code?: string }).code === 'ENOENT';

// One keep as a place's `keep` file holds it: every entry's bytes as hex,
// or null where it goes.
export type Keep = Record<string, string | null>;
const KEEP = 'keep';

const named = (name: string): string => {
  if (!isHex(name) || name === '') throw new Error(`${name} is not a name the kit chose`);
  return name;
};

const writeWhole = async (path: string, bytes: Uint8Array | string): Promise<void> => {
  await writeFile(`${path}.next`, bytes, { mode: 0o600 });
  await rename(`${path}.next`, path);
};

export class FolderMemory extends Memory {
  readonly root: string;
  #line: Promise<unknown> = Promise.resolve();

  constructor(root: string) {
    super();
    this.root = root;
  }

  // The entries as the disk holds them now, a keep left unapplied first.
  // A file that is not an entry, one still being written among them, is
  // not read.
  async read(place: string): Promise<Map<string, Uint8Array>> {
    const dir = join(this.root, named(place));
    await this.apply(dir);
    const out = new Map<string, Uint8Array>();
    const files = await readdir(dir, { withFileTypes: true }).catch((e: unknown) => (missing(e) ? [] : Promise.reject(e)));
    for (const file of files) {
      if (!file.isFile() || !isHex(file.name) || file.name === '') continue;
      out.set(file.name, new Uint8Array(await readFile(join(dir, file.name))));
    }
    return out;
  }

  // One keep at a time, written whole under `keep` before any entry moves.
  async write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    const dir = join(this.root, named(place));
    const keep: Keep = {};
    for (const [name, bytes] of entries) keep[named(name)] = bytes === null ? null : hex(bytes);
    const kept = this.#line.then(async () => {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeWhole(join(dir, KEEP), JSON.stringify(keep));
      await this.apply(dir, keep);
    });
    this.#line = kept.catch(() => undefined);
    await kept;
  }

  // Every folder of the root that is a place.
  async places(): Promise<string[]> {
    const files = await readdir(this.root, { withFileTypes: true }).catch((e: unknown) => (missing(e) ? [] : Promise.reject(e)));
    return files.filter((f) => f.isDirectory() && isHex(f.name) && f.name !== '').map((f) => f.name);
  }

  forget(place: string): Promise<void> {
    return rm(join(this.root, named(place)), { recursive: true, force: true });
  }

  // The keep a folder holds, applied and then gone. Writing the same bytes
  // again leaves the same place, so applying twice is applying once.
  protected async apply(dir: string, keep?: Keep): Promise<void> {
    const found = keep ?? (await readFile(join(dir, KEEP), 'utf8').then((text) => JSON.parse(text) as Keep, () => null));
    if (found === null) return;
    for (const [name, written] of Object.entries(found)) {
      const path = join(dir, named(name));
      if (written === null) await rm(path, { force: true });
      else await writeWhole(path, unhex(written));
    }
    await rm(join(dir, KEEP), { force: true });
    const left = await readdir(dir).catch((e: unknown) => (missing(e) ? [] : Promise.reject(e)));
    if (left.length === 0) await rm(dir, { recursive: true, force: true });
  }
}

export class FolderCustody extends Custody {
  readonly root: string;
  readonly #entropy: Entropy;

  constructor(root: string, entropy: Entropy) {
    super();
    this.root = root;
    this.#entropy = entropy;
  }

  // The seed the folder holds, or a drawn one written there the first time.
  // Two first asks at once keep the one written first.
  async seed(): Promise<Uint8Array> {
    const path = join(this.root, 'seed');
    const kept = await readFile(path, 'utf8').catch((e: unknown) => (missing(e) ? undefined : Promise.reject(e)));
    if (kept !== undefined) {
      const text = kept.trim();
      if (!isHex(text, 32)) throw new Error(`${path} is not a seed`);
      return unhex(text);
    }
    const seed = this.#entropy.draw(32);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    try {
      await writeFile(path, `${hex(seed)}\n`, { mode: 0o600, flag: 'wx' });
    } catch (e) {
      if ((e as { code?: string }).code === 'EEXIST') return this.seed();
      throw e;
    }
    return seed;
  }
}
