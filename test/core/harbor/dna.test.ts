// SPDX-License-Identifier: Apache-2.0
// The DNA against real git: a bare repository served by `git http-backend`
// behind a Node HTTP server on 127.0.0.1, fetched by the catalogue from
// its origin, `live` moved to what it fetched so the new classes stand, a
// wake that stands `live` with the server gone, and a harbor's DNA written
// out as a repository `git fsck` finds whole. The objects are read as the
// terrain keeps them, sealed under the seed the suite handed the harbor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CryptoEntropy, HeldCustody, VolatileMemory, World, type Harbor, type JsonObject } from '../kit.ts';
import { TEST } from '../classes.ts';
import { deflated, reachable } from '../../../src/core/git/index.ts';
import { Dna, Package } from '../../../src/core/harbor/index.ts';
import { holds } from '../../claims.ts';
import { being, root } from './asks.ts';
import { shop } from './shop.ts';

const catalogue = async (harbor: Harbor, method: string, args: JsonObject = {}): Promise<JsonObject> => (await being(harbor, 'catalogue', method, args)) as JsonObject;

// A harbor on bodies the suite holds, and its DNA as its memory keeps it,
// read afresh each time.
const held = async (world: World) => {
  const entropy = new CryptoEntropy();
  const memory = new VolatileMemory();
  const custody = new HeldCustody(entropy);
  const harbor = await world.harbor('h', { entropy, memory, custody });
  const pack = await Package.open(memory, entropy, await custody.seed());
  return { harbor, memory, dna: () => new Dna(memory, pack) };
};

// A ward `w` holding the counter `c`, and her count.
const counting = async (harbor: Harbor): Promise<void> => {
  await root(harbor, 'host', { ward: 'w' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'c', class: 'org.example.counter' }, 'w'), { booted: 'c' });
};
const count = (harbor: Harbor): Promise<unknown> => being(harbor, 'c', 'count', {}, 'w');

const WHO = { GIT_AUTHOR_NAME: 'author', GIT_AUTHOR_EMAIL: 'author@example.org', GIT_COMMITTER_NAME: 'author', GIT_COMMITTER_EMAIL: 'author@example.org', GIT_CONFIG_NOSYSTEM: '1' };
const git = (cwd: string, args: string[]): string => execFileSync('git', args, { cwd, env: { ...process.env, ...WHO, HOME: cwd } }).toString('utf8').trim();

const counter = (v: number): string => `import { Being } from 'nervur';
export const module = 'org.example.counter';
export const version = '${String(v)}';
class Counter extends Being {
  static kind = 'org.example.counter';
  static asks = { count: {} };
  count() {
    this.cells.n = (this.cells.n ?? 0) + 1;
    return { v: ${String(v)}, n: this.cells.n };
  }
}
export const classes = [Counter];
`;

// `git http-backend` as CGI behind a Node server: one process a request.
const serveGit = async (root: string): Promise<{ url: string; server: Server }> => {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url!, 'http://127.0.0.1');
      const cgi = spawn('git', ['http-backend'], {
        env: {
          ...process.env,
          GIT_PROJECT_ROOT: root,
          GIT_HTTP_EXPORT_ALL: '1',
          PATH_INFO: url.pathname,
          QUERY_STRING: url.search.slice(1),
          REQUEST_METHOD: req.method!,
          CONTENT_TYPE: req.headers['content-type'] ?? '',
          CONTENT_LENGTH: String(body.length),
          REMOTE_ADDR: '127.0.0.1',
        },
      });
      const out: Buffer[] = [];
      cgi.stdout.on('data', (c: Buffer) => out.push(c));
      cgi.on('close', () => {
        const all = Buffer.concat(out);
        const split = all.indexOf('\r\n\r\n');
        const head = all.subarray(0, split).toString('latin1').split('\r\n');
        let status = 200;
        const headers: Record<string, string> = {};
        for (const line of head) {
          const [name, ...rest] = line.split(':');
          const value = rest.join(':').trim();
          if (name!.toLowerCase() === 'status') status = Number(value.split(' ')[0]);
          else headers[name!] = value;
        }
        res.writeHead(status, headers);
        res.end(all.subarray(split + 4));
      });
      cgi.stdin.end(body);
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/dna.git`, server };
};

// A working repository whose commits push to a bare one the server serves.
const repos = async (): Promise<{ root: string; work: string; commit(files: Record<string, string>, message: string): Promise<string> }> => {
  const root = await mkdtemp(join(tmpdir(), 'nervur-dna-'));
  const work = join(root, 'work');
  await mkdir(work);
  git(root, ['init', '-q', '--bare', '-b', 'main', 'dna.git']);
  git(work, ['init', '-q', '-b', 'main']);
  git(work, ['remote', 'add', 'origin', join(root, 'dna.git')]);
  return {
    root,
    work,
    commit: async (files, message) => {
      for (const [path, text] of Object.entries(files)) {
        await mkdir(dirname(join(work, path)), { recursive: true });
        await writeFile(join(work, path), text);
      }
      git(work, ['add', '-A']);
      git(work, ['commit', '-q', '-m', message]);
      git(work, ['push', '-q', 'origin', 'main']);
      return git(work, ['rev-parse', 'HEAD']);
    },
  };
};

test(holds('dna.fetch', 'dna: fetch reads a real repository over smart HTTP, and live moved to what it fetched stands the new classes'), async () => {
  const { root, commit } = await repos();
  const { url, server } = await serveGit(root);
  try {
    const first = await commit({ 'modules/org.example.counter.js': counter(1), 'README.md': 'what this harbor runs\n' }, 'one counter');
    const harbor = await new World(TEST).harbor('h');
    assert.deepEqual(await catalogue(harbor, 'fetch'), { error: 'no origin is set' });
    assert.deepEqual(await catalogue(harbor, 'origin', { url: 'ftp://nowhere' }), { error: 'url is an http or https URL, or null' });
    assert.deepEqual(await catalogue(harbor, 'origin', { url }), { origin: url });
    const fetched = await catalogue(harbor, 'fetch');
    assert.deepEqual((fetched.refs as JsonObject)['refs/heads/main'], first);
    assert.equal(fetched.objects, 5, 'the commit, its two trees and its two blobs');
    assert.deepEqual(await catalogue(harbor, 'live', { commit: 'refs/heads/main' }), { live: first });
    await counting(harbor);
    assert.deepEqual(await count(harbor), { v: 1, n: 1 });
    const second = await commit({ 'modules/org.example.counter.js': counter(2), 'modules/org.example.shop.js': shop.source }, 'a second counter, and the shop');
    const again = await catalogue(harbor, 'fetch');
    assert.equal((again.refs as JsonObject)['refs/heads/main'], second);
    assert.deepEqual(await catalogue(harbor, 'live', { commit: second }), { live: second });
    assert.deepEqual(await count(harbor), { v: 2, n: 2 }, 'the fetched class, on her cells');
    assert.deepEqual(Object.keys((await catalogue(harbor, 'modules')).modules as JsonObject).sort(), ['org.example.counter', 'org.example.shop']);
    const log = ((await catalogue(harbor, 'log')).log as { commit: string }[]).map((l) => l.commit);
    assert.deepEqual(log, [second, first], "the remote's history, first parents");
    assert.deepEqual(await catalogue(harbor, 'live', { commit: first }), { live: first }, 'a rollback to a fetched commit');
    assert.deepEqual(await count(harbor), { v: 1, n: 3 });
    assert.deepEqual(await catalogue(harbor, 'live', { commit: second }), { live: second });
  } finally {
    await new Promise((done) => server.close(done));
    await rm(root, { recursive: true, force: true });
  }
});

test(holds('dna.haves', 'dna: a second fetch names what it holds, and downloads a thin pack of the new objects alone'), async () => {
  const { root, work, commit } = await repos();
  const { url, server } = await serveGit(root);
  const big = (n: number): string => Array.from({ length: 600 }, (_, k) => `line ${String(k)} of notes that change a little, round ${String(k === 300 ? n : 0)}`).join('\n');
  const packs: Uint8Array[] = [];
  const bare = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const res = await bare(input, init);
    if (!String(input).endsWith('/git-upload-pack')) return res;
    const bytes = new Uint8Array(await res.arrayBuffer());
    packs.push(bytes);
    return new Response(bytes, { status: res.status, headers: res.headers });
  };
  try {
    const first = await commit({ 'modules/org.example.counter.js': counter(1), 'notes.txt': big(1) }, 'a counter and notes');
    const harbor = await new World(TEST).harbor('h');
    await catalogue(harbor, 'origin', { url });
    assert.equal((await catalogue(harbor, 'fetch')).objects, 5, 'the commit, two trees, two blobs');
    assert.deepEqual(await catalogue(harbor, 'live', { commit: first }), { live: first });
    const second = await commit({ 'notes.txt': big(2) }, 'the notes, changed');
    assert.deepEqual(await catalogue(harbor, 'fetch'), { refs: { HEAD: second, 'refs/heads/main': second }, objects: 3 }, 'the commit, its root tree and the new blob, and nothing held');
    const said = new TextDecoder('latin1').decode(packs[1]!);
    assert.match(said.slice(0, said.indexOf('PACK')), /^0031ACK [0-9a-f]{40}\n$/, 'the server shares a have');
    const dir = await mkdtemp(join(tmpdir(), 'nervur-thin-'));
    try {
      git(dir, ['init', '-q', '--bare']);
      const pack = packs[1]!.subarray(said.indexOf('PACK'));
      assert.throws(() => execFileSync('git', ['index-pack', '--stdin'], { cwd: dir, input: pack, stdio: 'pipe' }), /unresolved delta/, 'a thin pack: a delta whose base only the harbor holds');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    assert.deepEqual(await catalogue(harbor, 'live', { commit: 'refs/heads/main' }), { live: second });
    assert.deepEqual(((await catalogue(harbor, 'modules')).modules as JsonObject)['org.example.counter'], { running: '1', blob: git(root, ['--git-dir', 'dna.git', 'rev-parse', `${second}:modules/org.example.counter.js`]) });
    assert.deepEqual(await catalogue(harbor, 'fetch'), { refs: { HEAD: second, 'refs/heads/main': second }, objects: 0 }, 'nothing new, nothing asked');
    git(work, ['tag', '-a', 'v1', '-m', 'the first', first]);
    git(work, ['push', '-q', 'origin', 'v1']);
    const tag = git(work, ['rev-parse', 'v1']);
    const tagged = await catalogue(harbor, 'fetch');
    assert.match(new TextDecoder('latin1').decode(packs.at(-1)!), /^0031ACK [0-9a-f]{40}\n0031ACK [0-9a-f]{40}\nPACK/, 'a have shared, acknowledged as read and again at done');
    assert.deepEqual(tagged, { refs: { HEAD: second, 'refs/heads/main': second, 'refs/tags/v1': tag }, objects: 1 }, 'the annotated tag alone');
    assert.deepEqual(await catalogue(harbor, 'fetch'), { refs: { HEAD: second, 'refs/heads/main': second, 'refs/tags/v1': tag }, objects: 0 }, 'a tag among the refs names no have');
    assert.deepEqual(await catalogue(harbor, 'live', { commit: first }), { live: first });
    assert.deepEqual(await catalogue(harbor, 'gc'), { collected: 2, kept: 9 }, 'a fetched ref keeps what it reaches, a tag and the commit it names among them, and genesis and its empty tree go');
    assert.deepEqual(await catalogue(harbor, 'live', { commit: 'refs/heads/main' }), { live: second });
  } finally {
    globalThis.fetch = bare;
    await new Promise((done) => server.close(done));
    await rm(root, { recursive: true, force: true });
  }
});

test(holds('dna.gc', 'dna: a refused commit leaves no object, gc keeps what live and the refs reach, and git fsck finds the rest whole'), async () => {
  const world = new World(TEST);
  const { harbor, memory, dna } = await held(world);
  const genesis = (await catalogue(harbor, 'live')).live as string;
  const one = (await catalogue(harbor, 'add', { source: shop.source })).live as string;
  const two = (await catalogue(harbor, 'add', { source: counter(1) })).live as string;
  const before = await dna().count();
  const twin = counter(1).replace("module = 'org.example.counter'", "module = 'org.example.twin'").replace("version = '1'", "version = '9'");
  assert.match((await catalogue(harbor, 'add', { source: twin })).error as string, /org\.example\.counter/, 'one kind in two modules');
  assert.match((await catalogue(harbor, 'add', { source: 'export const module = ;' })).error as string, /did not load/);
  assert.equal(await dna().count(), before, 'nothing refused wrote an object');
  assert.deepEqual(await catalogue(harbor, 'live', { commit: one }), { live: one });
  const kept = await reachable(dna(), one);
  const gone = (await reachable(dna(), two)).filter((id) => !kept.includes(id));
  assert.deepEqual(await catalogue(harbor, 'gc'), { collected: gone.length, kept: kept.length }, 'the commit live moved away from, and what only it reached');
  assert.equal(await dna().count(), kept.length, 'the DNA is exactly what live reaches');
  assert.equal(await dna().get(two), null);
  assert.match((await catalogue(harbor, 'live', { commit: two })).error as string, /is no object this harbor holds/);
  assert.deepEqual(await catalogue(harbor, 'gc'), { collected: 0, kept: kept.length }, 'a second gc forgets nothing');
  const dir = await mkdtemp(join(tmpdir(), 'nervur-dna-gc-'));
  try {
    git(dir, ['init', '-q', '-b', 'main']);
    for (const id of kept) {
      await mkdir(join(dir, '.git', 'objects', id.slice(0, 2)), { recursive: true });
      await writeFile(join(dir, '.git', 'objects', id.slice(0, 2), id.slice(2)), await deflated((await dna().get(id))!));
    }
    await writeFile(join(dir, '.git', 'refs', 'heads', 'main'), `${one}\n`);
    git(dir, ['fsck', '--strict', '--no-dangling']);
    assert.equal(/^count: (\d+)$/m.exec(git(dir, ['count-objects', '-v']))![1], String(await dna().count()), 'every object kept, and no other');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  assert.deepEqual(await catalogue(harbor, 'live', { commit: genesis }), { live: genesis }, 'the history live reaches stays, so a rollback stands');
  assert.deepEqual((await catalogue(harbor, 'modules')).modules, {});
  const restarted = await world.restart('h');
  assert.deepEqual(await catalogue(restarted, 'live'), { live: genesis });
  assert.deepEqual(await catalogue(restarted, 'live', { commit: one }), { live: one }, 'and forward again, across a restart');
  const shopBlob = (((await catalogue(restarted, 'modules')).modules as JsonObject)['org.example.shop'] as JsonObject).blob as string;
  assert.match((await catalogue(restarted, 'log', { commit: shopBlob })).error as string, /no commit/);
  for (const place of await memory.places()) if (Dna.occupies(place)) await memory.forget(place);
  const bare = await world.restart('h');
  assert.match((await catalogue(bare, 'modules')).failed as string, /is no object this harbor holds/, 'a wake whose live is not kept says why');
});

test(holds('dna.wake-offline', 'dna: a wake stands live from the objects kept, with its origin gone'), async () => {
  const { root, commit } = await repos();
  const { url, server } = await serveGit(root);
  const world = new World(TEST);
  let harbor = await world.harbor('h');
  try {
    const first = await commit({ 'modules/org.example.counter.js': counter(7) }, 'a counter');
    await catalogue(harbor, 'origin', { url });
    await catalogue(harbor, 'fetch');
    assert.deepEqual(await catalogue(harbor, 'live', { commit: first }), { live: first });
    await counting(harbor);
  } finally {
    await new Promise((done) => server.close(done));
    await rm(root, { recursive: true, force: true });
  }
  harbor = await world.restart('h');
  assert.deepEqual(await count(harbor), { v: 7, n: 1 });
  assert.match((await catalogue(harbor, 'fetch')).error as string, /fetch failed|ECONNREFUSED|answered/);
});

test(holds('dna.git-exact', "dna: a harbor's DNA written out as a repository is whole to git fsck, and git reads each module back"), async () => {
  const { harbor, dna } = await held(new World(TEST));
  await catalogue(harbor, 'add', { source: shop.source });
  const live = (await catalogue(harbor, 'add', { source: counter(1) })).live as string;
  const dir = await mkdtemp(join(tmpdir(), 'nervur-dna-out-'));
  try {
    git(dir, ['init', '-q', '-b', 'main']);
    for (const id of await reachable(dna(), live)) {
      await mkdir(join(dir, '.git', 'objects', id.slice(0, 2)), { recursive: true });
      await writeFile(join(dir, '.git', 'objects', id.slice(0, 2), id.slice(2)), await deflated((await dna().get(id))!));
    }
    await writeFile(join(dir, '.git', 'refs', 'heads', 'main'), `${live}\n`);
    git(dir, ['fsck', '--strict', '--no-dangling']);
    assert.equal(git(dir, ['show', 'main:modules/org.example.shop.js']), shop.source.trim());
    assert.deepEqual(git(dir, ['log', '--format=%s', 'main']).split('\n'), ['add org.example.counter 1', 'add org.example.shop 1', 'genesis']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
