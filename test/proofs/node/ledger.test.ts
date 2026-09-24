// LedgerMemory: the memory contract's suite, and what a ledger adds. Every
// write stands as a line, a torn last line is cut, an edited one is
// refused, and a restored copy is refused where a witness saw further.
import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { LedgerMemory } from '../../../src/node/ledger-memory.ts';
import { memorySuite } from '../suites/memory.ts';

const root = mkdtempSync(join(tmpdir(), 'nervur-ledger-'));
after(() => rmSync(root, { recursive: true, force: true }));
let count = 0;
const folder = () => mkdtempSync(join(root, `${++count}-`));
const bytes = (...values: number[]) => new Uint8Array(values);

memorySuite('LedgerMemory', () => new LedgerMemory(join(folder(), 'ledger')));
memorySuite('LedgerMemory with a witness', () => {
  const at = folder();
  return new LedgerMemory(join(at, 'ledger'), { witness: join(at, 'witness') });
});

const twoWrites = async (memory: LedgerMemory) => {
  const first = (await memory.write({ writes: { p: { a: bytes(1) } }, expect: { p: null } }))!;
  await memory.write({ writes: { p: { a: bytes(2) }, q: { b: bytes(3) } }, expect: { p: first.p!, q: null } });
};

test('LedgerMemory keeps every write as one line its owner alone reads, and opens on it again', async () => {
  const path = join(folder(), 'ledger');
  const memory = new LedgerMemory(path);
  await twoWrites(memory);
  const before = await memory.read({ place: 'p' });
  assert.equal(readFileSync(path, 'utf8').split('\n').length, 3, 'two lines, and the newline after the last');
  assert.equal(statSync(path).mode & 0o777, 0o600);
  const again = new LedgerMemory(path);
  assert.deepEqual(await again.read({ place: 'p' }), before);
  assert.deepEqual([...(await again.list())].sort(), ['p', 'q']);
});

test('LedgerMemory cuts a last line torn by a crash, and writes on after it', async () => {
  const path = join(folder(), 'ledger');
  const memory = new LedgerMemory(path);
  await twoWrites(memory);
  const version = (await memory.read({ place: 'q' })).version;
  appendFileSync(path, '{"n":3,"prev":"');
  const again = new LedgerMemory(path);
  assert.equal((await again.read({ place: 'q' })).version, version);
  assert.notEqual(await again.write({ writes: { q: { b: null } }, expect: { q: version } }), null);
  assert.deepEqual(await again.list(), ['p']);
});

test('LedgerMemory refuses a ledger edited in its middle', async () => {
  const path = join(folder(), 'ledger');
  const memory = new LedgerMemory(path);
  await twoWrites(memory);
  const [first, ...rest] = readFileSync(path, 'utf8').split('\n');
  writeFileSync(path, [first.replace('"01"', '"09"'), ...rest].join('\n'));
  await assert.rejects(new LedgerMemory(path).list(), /broken at line 2/);
});

test('A witness refuses a restored copy of the ledger, which would replay what the house answered', async () => {
  const at = folder();
  const path = join(at, 'ledger');
  const witness = join(at, 'witness');
  const memory = new LedgerMemory(path, { witness });
  const first = (await memory.write({ writes: { p: { a: bytes(1) } }, expect: { p: null } }))!;
  copyFileSync(path, join(at, 'backup'));
  await memory.write({ writes: { p: { a: bytes(2) } }, expect: { p: first.p! } });

  copyFileSync(join(at, 'backup'), path);
  await assert.rejects(new LedgerMemory(path, { witness }).list(), /behind its witness/);
  const unwitnessed = new LedgerMemory(path);
  assert.deepEqual(await unwitnessed.read({ place: 'p' }), { entries: { a: bytes(1) }, version: first.p }, 'with no witness, a restore is not seen');
});
