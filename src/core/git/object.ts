// SPDX-License-Identifier: Apache-2.0
// Git's objects, byte for byte as git writes them: a blob, a tree and a
// commit, each named by the SHA-1 of `<type> <size>\0` and its body.
//
//   tree     one entry after another, `<mode> <name>\0` and the 20 bytes of
//            its id, sorted by name as git sorts, a tree's name read with
//            a `/` after it
//   commit   `tree`, each `parent`, `author` and `committer` lines, a blank
//            line, and the message
import { concat, hex, unhex, utf8 } from '../crypto/bytes.ts';
import { own, subtle } from '../crypto/subtle.ts';
import { deflate, inflate } from './zlib.ts';

export type ObjectType = 'blob' | 'tree' | 'commit' | 'tag';
export type GitObject = { readonly type: ObjectType; readonly body: Uint8Array };

export const TYPES: readonly ObjectType[] = ['blob', 'tree', 'commit', 'tag'];

// The tree with no entry, which every empty commit names.
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const decoder = new TextDecoder('utf-8', { fatal: true });
export const text = (bytes: Uint8Array): string => decoder.decode(bytes);

export const sha1 = async (bytes: Uint8Array): Promise<string> => hex(new Uint8Array(await subtle().digest('SHA-1', own(bytes))));

export const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

// An object as git keeps it loose, before it is deflated.
export const loose = (o: GitObject): Uint8Array => concat(utf8(`${o.type} ${String(o.body.length)}\0`), o.body);

export const idOf = (o: GitObject): Promise<string> => sha1(loose(o));

export const readLoose = (bytes: Uint8Array): GitObject => {
  const nul = bytes.indexOf(0);
  const head = nul < 0 ? '' : text(bytes.subarray(0, nul));
  const [type, size] = head.split(' ');
  const body = bytes.subarray(nul + 1);
  if (!TYPES.includes(type as ObjectType) || String(body.length) !== size) throw new Error('no loose object');
  return { type: type as ObjectType, body: body.slice() };
};

// The file git writes under `.git/objects/`, and the object it holds.
export const deflated = (o: GitObject): Promise<Uint8Array> => deflate(loose(o));
export const inflated = async (bytes: Uint8Array): Promise<GitObject> => readLoose(await inflate(bytes));

export const blob = (source: string): GitObject => ({ type: 'blob', body: utf8(source) });

export const FILE = '100644';
export const DIRECTORY = '40000';
export type TreeEntry = { readonly mode: string; readonly name: string; readonly id: string };

const sortName = (e: TreeEntry): string => (e.mode === DIRECTORY ? `${e.name}/` : e.name);
const byName = (a: TreeEntry, b: TreeEntry): number => {
  const [x, y] = [utf8(sortName(a)), utf8(sortName(b))];
  for (let k = 0; k < Math.min(x.length, y.length); k += 1) if (x[k] !== y[k]) return x[k]! - y[k]!;
  return x.length - y.length;
};

export const tree = (entries: readonly TreeEntry[]): GitObject => ({
  type: 'tree',
  body: concat(...[...entries].sort(byName).flatMap((e) => [utf8(`${e.mode} ${e.name}\0`), unhex(e.id)])),
});

export const readTree = (o: GitObject): TreeEntry[] => {
  if (o.type !== 'tree') throw new Error('no tree');
  const entries: TreeEntry[] = [];
  for (let at = 0; at < o.body.length; ) {
    const space = o.body.indexOf(0x20, at);
    const nul = o.body.indexOf(0, space);
    if (space < 0 || nul < 0 || nul + 21 > o.body.length) throw new Error('a tree cut short');
    entries.push({ mode: text(o.body.subarray(at, space)), name: text(o.body.subarray(space + 1, nul)), id: hex(o.body.subarray(nul + 1, nul + 21)) });
    at = nul + 21;
  }
  return entries;
};

// Who made a commit and when, as git writes it.
export type Signature = { readonly name: string; readonly email: string; readonly seconds: number; readonly zone: string };
export type Commit = { readonly tree: string; readonly parents: readonly string[]; readonly author: Signature; readonly committer: Signature; readonly message: string };

const signed = (s: Signature): string => `${s.name} <${s.email}> ${String(s.seconds)} ${s.zone}`;
const readSigned = (line: string): Signature => {
  const m = /^(.*) <([^>]*)> (\d+) ([+-]\d{4})$/.exec(line);
  if (!m) throw new Error('a signature git does not write');
  return { name: m[1]!, email: m[2]!, seconds: Number(m[3]), zone: m[4]! };
};

export const commit = (c: Commit): GitObject => ({
  type: 'commit',
  body: utf8([`tree ${c.tree}`, ...c.parents.map((p) => `parent ${p}`), `author ${signed(c.author)}`, `committer ${signed(c.committer)}`, '', c.message].join('\n')),
});

// A commit's own headers, read; a header it does not name, a signature
// among them, is kept in the bytes and read past.
export const readCommit = (o: GitObject): Commit => {
  if (o.type !== 'commit') throw new Error('no commit');
  const all = text(o.body);
  const blank = all.indexOf('\n\n');
  const head = blank < 0 ? all : all.slice(0, blank);
  const message = blank < 0 ? '' : all.slice(blank + 2);
  let root: string | undefined;
  const parents: string[] = [];
  let author: Signature | undefined;
  let committer: Signature | undefined;
  for (const line of head.split('\n')) {
    const space = line.indexOf(' ');
    const [key, value] = [line.slice(0, space), line.slice(space + 1)];
    if (key === 'tree') root = value;
    else if (key === 'parent') parents.push(value);
    else if (key === 'author') author = readSigned(value);
    else if (key === 'committer') committer = readSigned(value);
  }
  if (!isId(root) || !author || !committer || !parents.every(isId)) throw new Error('a commit git does not write');
  return { tree: root, parents, author, committer, message };
};
