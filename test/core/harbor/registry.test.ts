// SPDX-License-Identifier: Apache-2.0
// What stands where, and through which registry: a faculty stands in the
// box ward alone and is lent as the class her own registry resolves, and a
// being stands in a hosted ward alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../kit.ts';
import { TEST } from '../classes.ts';
import { holds } from '../../claims.ts';
import { add, being, root } from './asks.ts';

// A clock contract, one faculty fulfilling it that only the shelf
// resolves, and a reader who lends the contract and asks it.
const SHELVED = `import { Being, Faculty, RegistryFaculty, Ward } from 'nervur';
export const module = 'com.acme.shelved';
export const version = '1';
class Clock extends Faculty {
  static kind = 'com.acme.clock';
}
class Tick extends Clock {
  static kind = 'com.acme.tick';
  static asks = { now: {} };
  now() {
    return { now: 42 };
  }
}
class Reader extends Being {
  static kind = 'com.acme.reader';
  static asks = { read: {} };
  async read() {
    if (!this.stance.standings.get('clock')) await this.stance.lend(Clock, 'clock');
    return { said: (await this.stance.standings.get('clock')?.ask('now')) ?? null };
  }
}
class Plain extends Being {
  static kind = 'com.acme.plain';
}
class Keeper extends Ward {
  static kind = 'com.acme.keeper';
}
const SHELF = [Tick, Keeper];
class Shelf extends RegistryFaculty {
  static kind = 'com.acme.shelf';
  classOf(kind) {
    return SHELF.find((C) => C.kind === kind);
  }
}
export const classes = [Shelf, Reader, Plain];
`;

const standing = async () => {
  const harbor = await new World(TEST).harbor('h');
  assert.equal(((await add(harbor, SHELVED)) as { added?: string }).added, 'com.acme.shelved');
  assert.deepEqual(await root(harbor, 'open', { key: 'shelf', class: 'com.acme.shelf' }), { opened: 'shelf' });
  return harbor;
};

test(holds('levels.registry', 'registry: a faculty is lent as the class her own registry resolves, not the catalogue'), async () => {
  const harbor = await standing();
  assert.deepEqual(await root(harbor, 'open', { key: 'tick', class: 'com.acme.tick', registry: 'shelf' }), { opened: 'tick' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'r', class: 'com.acme.reader' }, 'w'), { booted: 'r' });
  assert.deepEqual(await being(harbor, 'r', 'read', {}, 'w'), { said: { now: 42 } });
});

test(holds('faculty.dock-alone', 'registry: the box ward takes a faculty by open alone, and a hosted ward takes no faculty'), async () => {
  const harbor = await standing();
  assert.deepEqual(await root(harbor, 'boot', { key: 'p', class: 'com.acme.plain' }), { error: 'a faculty is opened, and nothing else stands in the box ward' });
  assert.deepEqual(await root(harbor, 'open', { key: 'p', class: 'com.acme.plain' }), { error: 'no such faculty' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'w', class: 'com.acme.keeper', registry: 'shelf' }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'boot', { key: 't', class: 'com.acme.tick' }, 'w'), { error: 'no such class' }, 'a faculty stands in the box ward alone');
  assert.deepEqual(Object.keys((await root(harbor, undefined, undefined, 'w')).notes as object), ['pk', 'class', 'beings']);
});
