// SPDX-License-Identifier: Apache-2.0
// The git layer against the `git` binary itself: the ids it gives equal
// git's own, what it deflates git inflates and back, a pack git writes
// with deltas of both kinds reads to the objects git holds, and a
// repository written from its objects is one `git fsck` finds whole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blob, commit, deflate, deflated, EMPTY_TREE, files, HeldObjects, idOf, inflate, inflated, inflateAt, readCommit, readPack, reachable, tree, writeCommit, writeTree, type Signature } from '../../../src/core/git/index.ts';
import { holds } from '../../claims.ts';

const git = (cwd: string, args: string[], input?: string | Uint8Array, env: Record<string, string> = {}): string =>
  execFileSync('git', args, { cwd, input, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: cwd, ...env }, maxBuffer: 1 << 26 }).toString('utf8').trim();

const WHO: Signature = { name: 'nervur', email: 'catalogue@nervur.org', seconds: 1_700_000_000, zone: '+0000' };
const DATES = { GIT_AUTHOR_NAME: WHO.name, GIT_AUTHOR_EMAIL: WHO.email, GIT_AUTHOR_DATE: '1700000000 +0000', GIT_COMMITTER_NAME: WHO.name, GIT_COMMITTER_EMAIL: WHO.email, GIT_COMMITTER_DATE: '1700000000 +0000' };

const repo = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'nervur-git-'));
  git(dir, ['init', '-q', '-b', 'main']);
  return dir;
};

test(holds('dna.git-exact', 'git: a blob, a tree and a commit have the ids git gives them'), async () => {
  const dir = await repo();
  try {
    const source = "import { Being } from 'nervur';\nexport const module = 'org.example.one';\n";
    const b = blob(source);
    assert.equal(await idOf(b), git(dir, ['hash-object', '-w', '--stdin'], source));
    const sub = tree([{ mode: '100644', name: 'org.example.one.js', id: await idOf(b) }, { mode: '100644', name: 'a.js', id: await idOf(b) }]);
    const root = tree([{ mode: '40000', name: 'modules', id: await idOf(sub) }, { mode: '100644', name: 'modules.js', id: await idOf(b) }]);
    assert.equal(await idOf(sub), git(dir, ['mktree'], `100644 blob ${await idOf(b)}\torg.example.one.js\n100644 blob ${await idOf(b)}\ta.js\n`));
    assert.equal(await idOf(root), git(dir, ['mktree'], `040000 tree ${await idOf(sub)}\tmodules\n100644 blob ${await idOf(b)}\tmodules.js\n`));
    assert.equal(await idOf(tree([])), EMPTY_TREE);
    const first = commit({ tree: EMPTY_TREE, parents: [], author: WHO, committer: WHO, message: 'genesis\n' });
    assert.equal(await idOf(first), git(dir, ['commit-tree', EMPTY_TREE, '-m', 'genesis'], undefined, DATES));
    const second = commit({ tree: await idOf(root), parents: [await idOf(first)], author: WHO, committer: WHO, message: 'add org.example.one 1\n' });
    assert.equal(await idOf(second), git(dir, ['commit-tree', await idOf(root), '-p', await idOf(first), '-m', 'add org.example.one 1'], undefined, DATES));
    assert.deepEqual(readCommit(second), { tree: await idOf(root), parents: [await idOf(first)], author: WHO, committer: WHO, message: 'add org.example.one 1\n' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(holds('dna.git-exact', 'git: what it deflates git reads, what git deflates it reads, and a stream in a pack says where it ends'), async () => {
  const dir = await repo();
  try {
    const source = 'x'.repeat(5000) + 'the end\n';
    const id = git(dir, ['hash-object', '-w', '--stdin'], source);
    const theirs = await readFile(join(dir, '.git', 'objects', id.slice(0, 2), id.slice(2)));
    assert.equal(new TextDecoder().decode((await inflated(theirs)).body), source);
    const own = await deflated(blob('ours\n'));
    const ownId = await idOf(blob('ours\n'));
    await mkdir(join(dir, '.git', 'objects', ownId.slice(0, 2)), { recursive: true });
    await writeFile(join(dir, '.git', 'objects', ownId.slice(0, 2), ownId.slice(2)), own);
    assert.equal(git(dir, ['cat-file', '-p', ownId]), 'ours');
    const bytes = new Uint8Array(20_000).map((_, k) => (k * 7919) % 251);
    assert.deepEqual(await inflate(await deflate(bytes)), bytes);
    const tail = new Uint8Array([...theirs, 1, 2, 3]);
    const { out, end } = inflateAt(tail, 0);
    assert.equal(end, theirs.length);
    assert.equal(new TextDecoder().decode(out).endsWith('the end\n'), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(holds('dna.pack', 'git: a pack git writes, with deltas by offset and by id, reads to every object git holds'), async () => {
  const dir = await repo();
  try {
    let text = Array.from({ length: 400 }, (_, k) => `line ${String(k)} of a module that changes a little each time`).join('\n');
    for (let n = 0; n < 5; n += 1) {
      text = `${text}\nand one more line, ${String(n)}`;
      await writeFile(join(dir, 'module.js'), text);
      git(dir, ['add', 'module.js']);
      git(dir, ['commit', '-q', '-m', `step ${String(n)}`], undefined, DATES);
    }
    const objects = git(dir, ['rev-list', '--objects', '--all']).split('\n').map((l) => l.split(' ')[0]!);
    for (const offsets of [true, false]) {
      const pack = execFileSync('git', ['pack-objects', '--stdout', '--window=10', ...(offsets ? ['--delta-base-offset'] : [])], { cwd: dir, input: `${objects.join('\n')}\n` });
      const file = join(dir, `${String(offsets)}.pack`);
      await writeFile(file, pack);
      git(dir, ['index-pack', file]);
      const deltas = git(dir, ['verify-pack', '-v', file.replace(/\.pack$/, '.idx')])
        .split('\n')
        .filter((l) => /^[0-9a-f]{40} \w+ \d+ \d+ \d+ \d+ [0-9a-f]{40}$/.test(l.replaceAll(/ +/g, ' ')));
      assert.ok(deltas.length > 0, 'the pack holds deltas');
      const read = await readPack(new Uint8Array(pack));
      assert.deepEqual([...read.keys()].sort(), [...objects].sort(), offsets ? 'by offset' : 'by id');
      for (const [id, o] of read) assert.equal(await idOf(o), id);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(holds('dna.git-exact', 'git: a repository written from its objects is whole to git fsck, and git reads its files back'), async () => {
  const dir = await repo();
  try {
    const store = new HeldObjects();
    const [a, b] = await store.put([blob('export const module = 1;\n'), blob('export const module = 2;\n'), tree([])]);
    const first = await writeCommit(store, { tree: EMPTY_TREE, parents: [], author: WHO, committer: WHO, message: 'genesis\n' });
    const root = await writeTree(store, new Map([['modules/org.example.a.js', a!], ['modules/org.example.b.js', b!]]));
    const second = await writeCommit(store, { tree: root, parents: [first], author: WHO, committer: WHO, message: 'two modules\n' });
    assert.deepEqual([...(await files(store, second))], [['modules/org.example.a.js', a], ['modules/org.example.b.js', b]]);
    for (const id of await reachable(store, second)) {
      await mkdir(join(dir, '.git', 'objects', id.slice(0, 2)), { recursive: true });
      await writeFile(join(dir, '.git', 'objects', id.slice(0, 2), id.slice(2)), await deflated((await store.get(id))!));
    }
    await writeFile(join(dir, '.git', 'refs', 'heads', 'main'), `${second}\n`);
    git(dir, ['fsck', '--strict', '--no-dangling']);
    assert.equal(git(dir, ['show', 'main:modules/org.example.b.js']), 'export const module = 2;');
    assert.equal(git(dir, ['rev-list', '--count', 'main']), '2');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
