// SPDX-License-Identifier: Apache-2.0
// A harbor on this machine, as the `nervur` command stands it: a harbor of
// the Node ground in a folder, served while `serve` runs, and asked over
// its root line's socket.
//
// A root request goes to a served harbor over its socket. With none served,
// the command unpacks the harbor from its folder, asks, and closes it, so
// one process at a time writes the folder.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JsonObject } from '../being/index.ts';
import { hex, unhex } from '../crypto/index.ts';
import { isHarborName, readPack, sealSeed, type Pack } from '../edge/index.ts';
import { FolderCustody, FolderMemory } from '../folder/index.ts';
import { carrierIn, carryPlaces, Harbor, landPlaces, readCarried, type Carried, type Defaults, type RootRequest } from '../harbor/index.ts';
import { askServed, NodeTerrain, socketOf } from '../node/index.ts';
import { CryptoEntropy } from '../pointer/index.ts';
import { tcpAddress } from '../quo/index.ts';

// A harbor of a folder, opened for one ask: it listens nowhere and serves
// nothing.
// Every harbor the command opens runs the defaults its entry hands it, and
// the command holds it, so it asks its `stand` once it opens.
const standing = async (terrain: NodeTerrain): Promise<Harbor> => {
  const harbor = await Harbor.open(terrain);
  await harbor.ask({ method: 'stand' });
  return harbor;
};

// The box ward's census, as the root reads it.
export type Census = { pk: string; beings: Record<string, { class: string; absent: boolean }>; listening: string[] };
export const census = async (harbor: Harbor): Promise<Census> => ((await harbor.ask({})).answer as { notes: Census }).notes;

export const open = (dir: string, defaults: Defaults): Promise<Harbor> => standing(new NodeTerrain({ dir, defaults, wakes: false, serves: false }));

// Whether a harbor of this folder is served now.
export const isServed = async (dir: string): Promise<boolean> => (await askServed(dir, {})) !== undefined;

export const request = async (dir: string, defaults: Defaults, req: RootRequest): Promise<JsonObject> => {
  const served = await askServed(dir, req);
  if (served !== undefined) return served;
  const harbor = await open(dir, defaults);
  try {
    return await harbor.ask(req);
  } finally {
    await harbor.close();
  }
};

// The harbor of a folder, read as bytes alone, its seed only where the
// one who asks says so, since custody holds it and a package without it
// opens nowhere. No harbor opens, so nothing is asked and nothing is
// written.
export const carry = async (dir: string, seed: boolean): Promise<Carried> => ({
  ...(seed ? { seed: hex(await new FolderCustody(dir, new CryptoEntropy()).seed()) } : {}),
  places: await carryPlaces(new FolderMemory(dir)),
});

// What `nervur edge pack` hands a deploy: the harbor of a folder, under
// its name, in the pack the worker bundles, its seed sealed under the
// worker's `NERVUR_SECRET` beside its sealed places. Its code travels in
// its places, as its DNA, so the edge loads what `live` names from there.
// Every other harbor the pack holds stays, so one worker carries them all,
// and nothing in the pack opens without the secret.
export const pack = async (dir: string, file: string, name: string, secret: string | undefined): Promise<JsonObject> => {
  if (!isHarborName(name)) throw new Error(`${name} is no harbor name: lowercase letters, digits and -`);
  if (!secret) throw new Error('edge pack seals the seed under NERVUR_SECRET, and none is set');
  if (!existsSync(join(dir, 'seed'))) throw new Error(`no harbor stands at ${dir}`);
  const { seed, places } = await carry(dir, true);
  const held = existsSync(file) ? readPack(JSON.parse(await readFile(file, 'utf8'))) : {};
  if (held === null) throw new Error(`${file} is no pack`);
  const packed: Pack = { ...held, [name]: { sealed: await sealSeed(secret, unhex(seed!)), places } };
  await writeFile(file, `${JSON.stringify(packed)}\n`, { mode: 0o600 });
  return { packed: name, package: file, harbors: Object.keys(packed).sort(), places: Object.keys(places).length };
};

// A carried harbor into an empty folder. A folder holding a seed or a
// place is left as it stands, and a package with no seed needs one there
// already, which a terrain that seals its custody writes its own way.
export const land = async (dir: string, value: unknown): Promise<string[]> => {
  const held = readCarried(value);
  if (held === null) throw new Error('that is no carried harbor');
  const memory = new FolderMemory(dir);
  if ((await memory.places()).length > 0 || (held.seed !== undefined && existsSync(join(dir, 'seed')))) throw new Error(`a harbor stands at ${dir}`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (held.seed !== undefined) await writeFile(join(dir, 'seed'), `${held.seed}\n`, { mode: 0o600, flag: 'wx' });
  else if (!existsSync(join(dir, 'seed'))) throw new Error('the package carries no seed, and none is held here');
  return landPlaces(memory, held);
};

// A served harbor: its pk, its tcp address, every address its carriers
// listen at, and its root line's socket.
export type Served = { pk: string; at: string; listening: string[]; root: string; close(): Promise<void> };

// The harbor served: a harbor of the Node ground, with Quo over the TCP
// carrier its root opened, on host and port. Serving adds nothing to the
// harbor, so one with no TCP carrier is not served.
export const serve = async (dir: string, defaults: Defaults, host?: string, port?: number): Promise<Served> => {
  if (!existsSync(join(dir, 'seed'))) throw new Error(`no harbor stands at ${dir}: init one first`);
  const harbor = await standing(new NodeTerrain({ dir, defaults }));
  const tcpOf = (listening: string[]): string | undefined => listening.find((address) => tcpAddress(address) !== null);
  const before = await census(harbor);
  const present = Object.fromEntries(Object.entries(before.beings).filter(([, being]) => !being.absent));
  const tcp = carrierIn(present, defaults.classes, 'tcp');
  if (tcp?.open !== undefined || tcp === null) {
    await harbor.close();
    const kind = tcp?.open?.args?.class;
    throw new Error(`the harbor at ${dir} has no tcp carrier${typeof kind === 'string' ? `: open one with \`nervur open tcp ${kind}\`` : ''}`);
  }
  if (host !== undefined || port !== undefined || tcpOf(before.listening) === undefined) {
    const heard = await harbor.ask({ method: 'ask', args: { being: tcp.key, method: 'listen', args: { ...(host === undefined ? {} : { host }), ...(port === undefined ? {} : { port }) } } });
    if (typeof ((heard.answer as JsonObject | undefined)?.answer as JsonObject | undefined)?.at !== 'string') {
      await harbor.close();
      throw new Error(`the harbor does not listen: ${JSON.stringify(heard.answer ?? heard)}`);
    }
  }
  const { pk, listening } = await census(harbor);
  return { pk, at: tcpOf(listening)!, listening, root: socketOf(dir), close: () => harbor.close() };
};
