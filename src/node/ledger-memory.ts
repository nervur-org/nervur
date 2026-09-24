// SPDX-License-Identifier: Apache-2.0
// Memory as a ledger: every write appended as one line, never rewritten.
// Each line carries its sequence and the hash of the line before it, and
// is synced before its write counts. So the file is also the whole record
// of what the house wrote. A witness, where the ground names one, keeps
// the last sequence and hash in a second place, and a ledger behind it is
// refused: a restored copy cannot replay what the house already answered.
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, truncate } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Memory, PlaceRead } from '../foundation.ts';
import { syncFolder } from './sync-folder.ts';

type Writes = Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
type Places = Map<string, { version: string; entries: Map<string, string> }>;

interface Line {
  readonly n: number;
  readonly prev: string;
  readonly writes: Record<string, Record<string, string | null>>;
}

interface Head {
  readonly n: number;
  readonly hash: string;
}

interface State {
  readonly places: Places;
  head: Head;
}

const GENESIS: Head = { n: 0, hash: '0'.repeat(64) };
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const unhex = (text: string) => new Uint8Array(Buffer.from(text, 'hex'));
const path = (at: string | URL) => (typeof at === 'string' ? at : fileURLToPath(at));

/** Opens a file, runs `work` on it, syncs it and lets it go. */
const synced = async (file: string, flags: string, work: (handle: Awaited<ReturnType<typeof open>>) => Promise<void>) => {
  const handle = await open(file, flags, 0o600);
  try {
    await work(handle);
    await handle.sync();
  } finally {
    await handle.close();
  }
};

/** A line laid on the places: each place it names takes the line's sequence as its version. */
const apply = (places: Places, line: Line): Record<string, string | null> => {
  const version = String(line.n);
  const versions: Record<string, string | null> = {};
  for (const [place, entries] of Object.entries(line.writes)) {
    const held = places.get(place) ?? { version, entries: new Map<string, string>() };
    for (const [name, value] of Object.entries(entries)) {
      if (value === null) held.entries.delete(name);
      else held.entries.set(name, value);
    }
    held.version = version;
    if (held.entries.size === 0) places.delete(place);
    else places.set(place, held);
    versions[place] = held.entries.size === 0 ? null : version;
  }
  return versions;
};

export class LedgerMemory implements Memory {
  readonly #path: string;
  readonly #witness: string | undefined;
  #state: Promise<State> | undefined;
  #turn: Promise<unknown> = Promise.resolve();

  constructor(at: string | URL, { witness }: { witness?: string | URL } = {}) {
    this.#path = path(at);
    this.#witness = witness === undefined ? undefined : path(witness);
  }

  #open(): Promise<State> {
    this.#state ??= this.#load();
    this.#state.catch(() => (this.#state = undefined));
    return this.#state;
  }

  async #load(): Promise<State> {
    await mkdir(dirname(this.#path), { recursive: true });
    let text = '';
    try {
      text = await readFile(this.#path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    // A last line with no newline was never synced whole, so its write never
    // counted: it is cut away.
    const whole = text.lastIndexOf('\n') + 1;
    if (whole < text.length) await truncate(this.#path, Buffer.byteLength(text.slice(0, whole)));
    const places: Places = new Map();
    let head = GENESIS;
    for (const raw of text.slice(0, whole).split('\n').slice(0, -1)) {
      const line = JSON.parse(raw) as Line;
      if (line.n !== head.n + 1 || line.prev !== head.hash) throw new Error(`the ledger ${this.#path} is broken at line ${head.n + 1}`);
      apply(places, line);
      head = { n: line.n, hash: hash(raw) };
    }
    const witnessed = this.#witness === undefined ? null : await this.#witnessed();
    if (witnessed !== null && (head.n < witnessed.n || (head.n === witnessed.n && head.hash !== witnessed.hash))) {
      throw new Error(`the ledger ${this.#path} is behind its witness: it holds ${head.n} lines, and the witness saw ${witnessed.n}`);
    }
    return { places, head };
  }

  async #witnessed(): Promise<Head | null> {
    try {
      return JSON.parse(await readFile(this.#witness!, 'utf8')) as Head;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async #attest(head: Head): Promise<void> {
    const temporary = `${this.#witness!}.${process.pid}.tmp`;
    await synced(temporary, 'w', (handle) => handle.writeFile(JSON.stringify(head)));
    await rename(temporary, this.#witness!);
    await syncFolder(dirname(this.#witness!));
  }

  async read({ place }: { place: string }): Promise<PlaceRead> {
    const held = (await this.#open()).places.get(place);
    if (held === undefined) return { entries: {}, version: null };
    return { entries: Object.fromEntries([...held.entries].map(([name, value]) => [name, unhex(value)])), version: held.version };
  }

  async list(): Promise<readonly string[]> {
    return [...(await this.#open()).places.keys()];
  }

  write(options: { writes: Writes; expect: Readonly<Record<string, string | null>> }): Promise<Readonly<Record<string, string | null>> | null> {
    const turn = this.#turn.then(() => this.#write(options));
    this.#turn = turn.catch(() => undefined);
    return turn;
  }

  async #write({ writes, expect }: { writes: Writes; expect: Readonly<Record<string, string | null>> }): Promise<Readonly<Record<string, string | null>> | null> {
    const state = await this.#open();
    for (const place of new Set([...Object.keys(writes), ...Object.keys(expect)])) {
      if (!(place in expect) || expect[place] !== (state.places.get(place)?.version ?? null)) return null;
    }
    const line: Line = {
      n: state.head.n + 1,
      prev: state.head.hash,
      writes: Object.fromEntries(Object.entries(writes).map(([place, entries]) => [place, Object.fromEntries(Object.entries(entries).map(([name, bytes]) => [name, bytes === null ? null : Buffer.from(bytes).toString('hex')]))])),
    };
    const raw = JSON.stringify(line);
    const head = { n: line.n, hash: hash(raw) };
    try {
      await synced(this.#path, 'a', (handle) => handle.appendFile(`${raw}\n`));
      if (line.n === 1) await syncFolder(dirname(this.#path));
      if (this.#witness !== undefined) await this.#attest(head);
    } catch (error) {
      // What landed is read again from the file: a torn line is cut, and a
      // whole one stands. The write answers as failed either way.
      this.#state = undefined;
      throw error;
    }
    state.head = head;
    return apply(state.places, line);
  }
}
