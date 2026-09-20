// SPDX-License-Identifier: Apache-2.0
// Git's smart HTTP protocol, the fetching side alone, over `fetch`:
//
//   GET  <url>/info/refs?service=git-upload-pack   every ref the remote has
//   POST <url>/git-upload-pack                      a pack of what is wanted
//
// Protocol v0, which every git server speaks: the refs come as pkt-lines
// after the service line, the first carrying the capabilities. The
// request wants every ref's commit not held already, asks `ofs-delta` and
// `thin-pack` and no side band and no multi_ack, names up to `HAVES` of
// the commits held as haves, and ends with `done`, all in one round. The
// server answers `ACK <id>` for the first have it shares and again at
// `done`, or `NAK` where it shares none, and then the pack of what the haves do not reach, its
// deltas free to name an object held here as their base. It reads and
// writes nothing else on the remote.
import { concat } from '../crypto/bytes.ts';
import { isId, readCommit, type GitObject } from './object.ts';
import { FLUSH, pkt, readPack, readPkts } from './pack.ts';

const SERVICE = 'git-upload-pack';
const AGENT = 'agent=nervur';

export type Refs = Record<string, string>;

const base = (url: string): string => url.replace(/\/+$/, '');

// Every ref the remote at `url` has, by name, peeled tags left out.
export const listRefs = async (url: string): Promise<Refs> => {
  const res = await fetch(`${base(url)}/info/refs?service=${SERVICE}`, { headers: { accept: `application/x-${SERVICE}-advertisement` } });
  if (!res.ok) throw new Error(`${url} answered ${String(res.status)}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const service = readPkts(bytes);
  if (service.lines[0]?.trim() !== `# service=${SERVICE}`) throw new Error(`${url} is no git repository over smart HTTP`);
  const refs: Refs = {};
  for (const line of readPkts(bytes, service.end).lines) {
    const [said] = line.replace(/\n$/, '').split('\0');
    const [id, name] = said!.split(' ');
    if (isId(id) && name !== undefined && !name.endsWith('^{}') && !/^0{40}$/.test(id)) refs[name] = id;
  }
  return refs;
};

// The most haves one request names: the newest commits held, enough that
// a remote which moved a little finds one it shares.
export const HAVES = 256;

// The commits held from `tips` back, newest first by committer time, at
// most `HAVES`; a commit not held ends its line.
export const havesFrom = async (tips: readonly string[], held: (id: string) => Promise<GitObject | null>): Promise<string[]> => {
  const out: string[] = [];
  const seen = new Set<string>();
  const pending: { id: string; seconds: number; parents: readonly string[] }[] = [];
  const open = async (id: string): Promise<void> => {
    if (seen.has(id)) return;
    seen.add(id);
    const o = await held(id);
    if (o?.type !== 'commit') return;
    const c = readCommit(o);
    pending.push({ id, seconds: c.committer.seconds, parents: c.parents });
  };
  for (const id of tips) await open(id);
  while (pending.length > 0 && out.length < HAVES) {
    pending.sort((a, b) => b.seconds - a.seconds);
    const next = pending.shift()!;
    out.push(next.id);
    for (const p of next.parents) await open(p);
  }
  return out;
};

// A pack of every commit named and all it reaches that `held` does not
// hold, read into objects by id. `haves` are commits held, so the pack
// leaves out what they reach, and a delta in it may name as its base an
// object `held` holds.
export const fetchPack = async (url: string, wants: readonly string[], held: (id: string) => Promise<GitObject | null>, haves: readonly string[] = []): Promise<Map<string, GitObject>> => {
  const missing: string[] = [];
  for (const id of new Set(wants)) if (!(await held(id))) missing.push(id);
  if (missing.length === 0) return new Map();
  const body = concat(
    ...missing.map((id, n) => pkt(n === 0 ? `want ${id} ofs-delta thin-pack ${AGENT}\n` : `want ${id}\n`)),
    FLUSH,
    ...haves.slice(0, HAVES).map((id) => pkt(`have ${id}\n`)),
    pkt('done\n'),
  );
  const res = await fetch(`${base(url)}/${SERVICE}`, {
    method: 'POST',
    headers: { 'content-type': `application/x-${SERVICE}-request`, accept: `application/x-${SERVICE}-result` },
    body: Uint8Array.from(body),
  });
  if (!res.ok) throw new Error(`${url} answered ${String(res.status)}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Each `ACK` or `NAK` line up to the pack: a have shared is acknowledged
  // as it is read and again at `done`.
  let end = 0;
  const said: string[] = [];
  while (end < bytes.length && new TextDecoder('latin1').decode(bytes.subarray(end, end + 4)) !== 'PACK') {
    const next = readPkts(bytes, end, () => true);
    said.push(...next.lines);
    if (next.end === end || !/^(ACK|NAK)/.test(next.lines.at(-1) ?? '')) throw new Error(`${url} sent no pack: ${said.join(' ').slice(0, 200) || 'nothing'}`);
    end = next.end;
  }
  return readPack(bytes.subarray(end), held);
};
