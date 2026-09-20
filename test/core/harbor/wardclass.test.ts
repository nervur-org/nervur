// SPDX-License-Identifier: Apache-2.0
// A ward's class: the WARD row's kind, resolved as every row's is, the
// terrain's at genesis, and another named by `host` or by `become`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BundleLoader, SourceLoader, World, type Harbor, type JsonObject } from '../kit.ts';
import { TEST, TestDock, TestWard } from '../classes.ts';
import { holds } from '../../claims.ts';
import { add, being, census, root } from './asks.ts';

const WARDS = `import { Being, Dock, Faculty, ownerAsk, Ward } from 'nervur';
export const module = 'com.acme.wards';
export const version = '1';
class OwnWard extends Ward {
  static kind = 'com.acme.own-ward';
  static asks = { ...Ward.asks, hello: ownerAsk('a greeting from this ward') };
  hello() {
    return { hello: this.stance.key, cells: Object.keys(this.cells).length };
  }
}
class OwnDock extends Dock {
  static kind = 'com.acme.own-dock';
  static asks = { ...Dock.asks, wave: ownerAsk('a wave from this dock') };
  wave() {
    return { waved: this.hosted.map((h) => h.ward) };
  }
}
class Shop extends Being {
  static kind = 'com.acme.shop';
}
class Timer extends Faculty {
  static kind = 'com.acme.timer';
}
export const classes = [OwnWard, OwnDock, Shop, Timer];
`;
const MODULE = 'com.acme.wards';
const OwnWard = 'com.acme.own-ward';
const OwnDock = 'com.acme.own-dock';
const Shop = 'com.acme.shop';
const Timer = 'com.acme.timer';
const NONE = { wards: {}, routes: {} };

const removed = async (harbor: Harbor): Promise<unknown> => {
  const answer = (await being(harbor, 'catalogue', 'remove', { module: MODULE })) as JsonObject;
  return answer.error === undefined ? { removed: answer.removed } : answer;
};

const stand = async (world: World): Promise<Harbor> => {
  const harbor = await world.harbor('h');
  const answer = (await add(harbor, WARDS)) as JsonObject;
  assert.deepEqual([answer.added, answer.version], [MODULE, '1']);
  return harbor;
};

test(holds('ward.class-hosted', 'ward class: a hosted ward of a class `host` names answers its own asks, and stands so again after a restart'), async () => {
  const world = new World(TEST);
  const harbor = await stand(world);
  assert.deepEqual(await root(harbor, 'host', { ward: 'w', class: OwnWard }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'd', class: OwnDock }), { error: 'no such ward class' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'n', class: 'com.acme.none' }), { error: 'no such ward class' });
  assert.deepEqual(await root(harbor, 'hello', undefined, 'w'), { hello: 'ward', cells: 0 });
  assert.deepEqual(await root(harbor, 'boot', { key: 's', class: Shop }, 'w'), { booted: 's' });
  assert.equal((await census(harbor, 'w')).class, OwnWard);
  const again = await world.restart('h');
  assert.deepEqual(await root(again, 'hello', undefined, 'w'), { hello: 'ward', cells: 0 });
  assert.deepEqual((await census(again, 'w')).beings, { s: { class: Shop, public: false, absent: false } });
  assert.deepEqual(await root(again, 'host', { ward: 'x' }), { hosted: 'x' });
  assert.equal((await census(again, 'x')).class, TestWard.kind);
  assert.deepEqual(await root(again, 'hello', undefined, 'x'), { error: 'unknown ask' });
});

test(holds('ward.class-dock', 'ward class: the dock becomes a class a module brings, stands so again once the catalogue wakes, and the default dock stands with why where it is gone'), async () => {
  const world = new World(TEST);
  const harbor = await stand(world);
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'wave'), { error: 'unknown ask' });
  assert.deepEqual(await root(harbor, 'become', { class: OwnDock }), { became: OwnDock });
  assert.deepEqual(await root(harbor, 'wave'), { waved: ['w'] });
  assert.equal((await census(harbor)).class, OwnDock);
  const again = await world.restart('h');
  assert.equal((await census(again)).class, OwnDock, 'born again of her row once the catalogue wakes');
  assert.deepEqual(await root(again, 'wave'), { waved: ['w'] });
  assert.deepEqual((await census(again)).failed, NONE);
  assert.deepEqual(await root(again, 'boot', { key: 's', class: Shop }, 'w'), { booted: 's' }, 'her hosted wards stand');
  const lost = await world.restart('h', { loader: new BundleLoader([]) });
  assert.equal((await census(lost)).class, TestDock.kind);
  assert.deepEqual(await root(lost, 'wave'), { error: 'unknown ask' });
  assert.deepEqual((await census(lost)).failed, { wards: { box: `no class of kind ${OwnDock} runs` }, routes: {} });
  const back = await world.restart('h', { loader: new SourceLoader() });
  assert.deepEqual(await root(back, 'wave'), { waved: ['w'] }, 'her row kept her kind');
  assert.deepEqual((await census(back)).failed, NONE);
});

test(holds('ward.become-refuses', 'ward class: become refuses a kind that does not resolve, a dock for a hosted ward, a ward for the box, and a class that is no ward'), async () => {
  const world = new World(TEST);
  const harbor = await stand(world);
  assert.deepEqual(await root(harbor, 'open', { key: 't', class: Timer }), { opened: 't' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'become', { class: 'com.acme.none' }), { error: 'no class of kind com.acme.none runs' });
  assert.deepEqual(await root(harbor, 'become', { class: OwnWard }), { error: `${OwnWard} is no dock` });
  assert.deepEqual(await root(harbor, 'become', { class: Shop }), { error: `${Shop} is no dock` });
  assert.deepEqual(await root(harbor, 'become', { class: 7 }), { error: 'class is text' });
  assert.deepEqual(await root(harbor, 'become', { class: OwnDock }, 'w'), { error: `${OwnDock} is no hosted ward` });
  assert.deepEqual(await root(harbor, 'become', { class: TestDock.kind }, 'w'), { error: `${TestDock.kind} is no hosted ward` });
  assert.deepEqual(await root(harbor, 'become', { class: Shop }, 'w'), { error: `${Shop} is no hosted ward` });
  assert.deepEqual(await root(harbor, 'become', { class: Timer }, 'w'), { error: `${Timer} is no hosted ward` });
  assert.deepEqual(await root(harbor, 'boot', { key: 'o', class: OwnWard }, 'w'), { error: 'no such class' }, 'a ward class boots no being');
  assert.deepEqual(await root(harbor, 'become', { class: OwnWard }, 'w'), { became: OwnWard });
  assert.deepEqual(await root(harbor, 'hello', undefined, 'w'), { hello: 'ward', cells: 0 });
  const again = await world.restart('h');
  assert.deepEqual(await root(again, 'hello', undefined, 'w'), { hello: 'ward', cells: 0 });
  assert.equal((await census(again)).class, TestDock.kind);
});

test(holds('catalogue.remove-ward', 'ward class: a module is not removed while a ward stands on one of its kinds'), async () => {
  const harbor = await stand(new World(TEST));
  assert.deepEqual(await root(harbor, 'host', { ward: 'w', class: OwnWard }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'become', { class: OwnDock }), { became: OwnDock });
  assert.deepEqual(await removed(harbor), { error: 'a being stands on this module' });
  assert.deepEqual(await root(harbor, 'become', { class: TestWard.kind }, 'w'), { became: TestWard.kind });
  assert.deepEqual(await removed(harbor), { error: 'a being stands on this module' }, 'the dock stands on it still');
  assert.deepEqual(await root(harbor, 'become', { class: TestDock.kind }), { became: TestDock.kind });
  assert.deepEqual(await removed(harbor), { removed: MODULE });
});
