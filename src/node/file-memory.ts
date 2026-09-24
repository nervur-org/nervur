// SPDX-License-Identifier: Apache-2.0
// Memory in one file, rewritten whole. A write goes to a temporary file,
// which is synced, renamed over the file, and followed by a sync of its
// folder, so every place lands together. It suits a small house.
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Memory, PlaceRead } from '../foundation.ts';
import { syncFolder } from './sync-folder.ts';

interface Stored {
  places: Record<string, { version: number; entries: Record<string, string> }>;
}

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const unhex = (text: string) => new Uint8Array(Buffer.from(text, 'hex'));

export class FileMemory implements Memory {
  readonly #path: string;
  #stored: Promise<Stored> | undefined;
  #turn: Promise<unknown> = Promise.resolve();

  constructor(path: string | URL) {
    this.#path = typeof path === 'string' ? path : fileURLToPath(path);
  }

  #load(): Promise<Stored> {
    this.#stored ??= readFile(this.#path, 'utf8').then(
      (text) => JSON.parse(text) as Stored,
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return { places: {} };
        throw error;
      },
    );
    return this.#stored;
  }

  async read({ place }: { place: string }): Promise<PlaceRead> {
    const held = (await this.#load()).places[place];
    if (held === undefined) return { entries: {}, version: null };
    return { entries: Object.fromEntries(Object.entries(held.entries).map(([name, text]) => [name, unhex(text)])), version: String(held.version) };
  }

  async list(): Promise<readonly string[]> {
    return Object.keys((await this.#load()).places);
  }

  write(options: {
    writes: Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
    expect: Readonly<Record<string, string | null>>;
  }): Promise<Readonly<Record<string, string | null>> | null> {
    const turn = this.#turn.then(() => this.#write(options));
    this.#turn = turn.catch(() => undefined);
    return turn;
  }

  async #write({
    writes,
    expect,
  }: {
    writes: Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
    expect: Readonly<Record<string, string | null>>;
  }): Promise<Readonly<Record<string, string | null>> | null> {
    const stored = await this.#load();
    for (const place of new Set([...Object.keys(writes), ...Object.keys(expect)])) {
      const held = stored.places[place];
      if (!(place in expect) || expect[place] !== (held === undefined ? null : String(held.version))) return null;
    }
    const next: Stored = structuredClone(stored);
    const versions: Record<string, string | null> = {};
    for (const [place, entries] of Object.entries(writes)) {
      const held = next.places[place] ?? { version: 0, entries: {} };
      for (const [name, bytes] of Object.entries(entries)) {
        if (bytes === null) delete held.entries[name];
        else held.entries[name] = hex(bytes);
      }
      held.version++;
      if (Object.keys(held.entries).length === 0) {
        delete next.places[place];
        versions[place] = null;
      } else {
        next.places[place] = held;
        versions[place] = String(held.version);
      }
    }
    await this.#persist(next);
    this.#stored = Promise.resolve(next);
    return versions;
  }

  async #persist(stored: Stored): Promise<void> {
    const folder = dirname(this.#path);
    await mkdir(folder, { recursive: true });
    const temporary = `${this.#path}.${process.pid}.tmp`;
    const file = await open(temporary, 'w', 0o600);
    try {
      await file.writeFile(JSON.stringify(stored));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, this.#path);
    await syncFolder(folder);
  }
}
