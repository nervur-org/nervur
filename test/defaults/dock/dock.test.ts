// SPDX-License-Identifier: Apache-2.0
// The default dock and the default ward, on the core and nothing else of
// the defaults: each is its contract as it stands, the one a harbor takes
// at genesis and wherever its own does not stand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BundleLoader, SourceLoader, World, type JsonObject } from '../../core/kit.ts';
import { TEST } from '../../core/classes.ts';
import { DefaultDock, DefaultWard } from '../../../src/defaults/index.ts';
import { holds } from '../../claims.ts';
import { add, census, root } from '../../core/harbor/asks.ts';

// The core's test classes, with the default dock and ward in their place.
const DEFAULTED = { ...TEST, dock: DefaultDock, ward: DefaultWard };

const QUAY = `import { Dock, ownerAsk } from 'nervur';
export const module = 'com.acme.quay';
export const version = '1';
class Quay extends Dock {
  static kind = 'com.acme.quay';
  static asks = { ...Dock.asks, moor: ownerAsk('the wards moored here') };
  moor() {
    return { moored: this.hosted.map((h) => h.ward) };
  }
}
export const classes = [Quay];
`;

test(holds('ward.class-dock', 'defaults: a new harbor stands the default dock and hosts the default ward, and the default dock stands again where her own is gone'), async () => {
  const world = new World(DEFAULTED);
  const harbor = await world.harbor('h');
  assert.equal((await census(harbor)).class, DefaultDock.kind, 'the dock at genesis');
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  assert.equal((await census(harbor, 'w')).class, DefaultWard.kind, 'the ward where none is named');
  assert.equal(((await add(harbor, QUAY)) as JsonObject).added, 'com.acme.quay');
  assert.deepEqual(await root(harbor, 'become', { class: 'com.acme.quay' }), { became: 'com.acme.quay' });
  assert.deepEqual(await root(harbor, 'moor'), { moored: ['w'] });
  const lost = await world.restart('h', { loader: new BundleLoader([]) });
  assert.equal((await census(lost)).class, DefaultDock.kind, 'the default dock stands in hers');
  assert.deepEqual((await census(lost)).failed!.wards, { box: 'no class of kind com.acme.quay runs' });
  const back = await world.restart('h', { loader: new SourceLoader() });
  assert.deepEqual(await root(back, 'moor'), { moored: ['w'] }, 'and hers again once it runs');
});
