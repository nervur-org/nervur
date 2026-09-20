// SPDX-License-Identifier: Apache-2.0
// The default ward, on the core and nothing else of the defaults: the
// ward a hosted ward takes where none is named, one it becomes again, and
// one a module's ward extends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, type JsonObject } from '../../core/kit.ts';
import { TEST } from '../../core/classes.ts';
import { DefaultWard } from '../../../src/defaults/index.ts';
import { holds } from '../../claims.ts';
import { add, census, root } from '../../core/harbor/asks.ts';

// The module's ward extends the default ward, which the kit it reads binds
// only where the defaults run, so the harbor runs it from the class alone.
class Steward extends DefaultWard {
  static override readonly kind: string = 'com.acme.steward';
}
const STEWARDS = `import { Being } from 'nervur';
export const module = 'com.acme.stewards';
export const version = '1';
class Guest extends Being {
  static kind = 'com.acme.guest';
}
export const classes = [Guest];
`;

test(holds('ward.class-hosted', 'defaults: a hosted ward takes the default ward where none is named, becomes it again, and a class extending it stands as itself'), async () => {
  const harbor = await new World({ ...TEST, ward: DefaultWard, classes: [...TEST.classes, Steward] }).harbor('h');
  assert.equal(((await add(harbor, STEWARDS)) as JsonObject).added, 'com.acme.stewards');
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  assert.equal((await census(harbor, 'w')).class, DefaultWard.kind);
  assert.deepEqual(await root(harbor, 'boot', { key: 'g', class: 'com.acme.guest' }, 'w'), { booted: 'g' });
  assert.deepEqual(await root(harbor, 'become', { class: Steward.kind }, 'w'), { became: Steward.kind });
  assert.equal((await census(harbor, 'w')).class, Steward.kind, 'a class extending the default, as its own kind');
  assert.deepEqual(await root(harbor, 'become', { class: DefaultWard.kind }, 'w'), { became: DefaultWard.kind });
  assert.deepEqual((await census(harbor, 'w')).beings, { g: { class: 'com.acme.guest', public: false, absent: false } }, 'her beings stay hers');
});
