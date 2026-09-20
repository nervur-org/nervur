// SPDX-License-Identifier: Apache-2.0
// Kinds: what a row keeps for a class and what a being lends by, a reversed
// domain and a name declared on the class and never inherited, so nothing
// collides inside a harbor and a bundler's renaming changes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Being, CarrierFaculty, Dock, Faculty, MemoryFaculty, Registry, UNDIALED, Ward, World, type Dialed, type Harbor, type JsonObject } from '../kit.ts';
import { TEST, TestDock, TestWard } from '../classes.ts';
import { isKind, kindOf, ownKind } from '../../../src/core/being/index.ts';
import { holds } from '../../claims.ts';
import { add, being, census, root } from '../harbor/asks.ts';

test('[kind] a kind is a reversed domain and a name, lowercase, three segments at least', () => {
  for (const kind of ['com.acme.shop', 'com.acme.billing.invoice', 'io.acme-labs.shop-2', 'org.nervur.dock', '0.1.2']) assert.ok(isKind(kind), kind);
  for (const kind of ['shop', 'acme.shop', 'com.Acme.shop', 'com.acme.', '.com.acme', 'com..acme.shop', 'com.acme.sh op', 'com.-acme.shop', 'com.acme/shop', 'com.acme.shop_2', 7, null]) assert.ok(!isKind(kind), String(kind));
});

test(holds('kind.declared', 'kind: a class declares its own kind, and one it inherits is none'), () => {
  class Parent extends Being {
    static override kind = 'com.acme.parent';
  }
  class Child extends Parent {}
  class Bad extends Being {
    static override kind = 'Bad';
  }
  assert.equal(ownKind(Parent), 'com.acme.parent');
  assert.equal(ownKind(Child), undefined);
  assert.equal(ownKind(Bad), undefined);
  assert.equal(ownKind('com.acme.parent'), undefined);
  assert.throws(() => kindOf(Child), /Child declares no kind of its own/);
  assert.throws(() => kindOf(undefined), /undefined declares no kind/);
});

const acme = (...classes: unknown[]) => ({ module: 'com.acme.test', version: '1', classes });

abstract class Timer extends Faculty {
  static override kind = 'com.acme.timer';
}
class Interval extends Timer {
  static override kind = 'com.acme.interval';
}

test(holds('registry.refuses-split', 'kind: a registry refuses a catalogue two readings could split'), () => {
  class Unkinded extends Being {}
  class Kit extends Being {
    static override kind = 'org.nervur.mine';
  }
  class One extends Being {
    static override kind = 'com.acme.one';
  }
  class Other extends Being {
    static override kind = 'com.acme.one';
  }
  abstract class Bare extends Faculty {}
  class OnBare extends Bare {
    static override kind = 'com.acme.on-bare';
  }
  abstract class KitContract extends Faculty {
    static override kind = 'org.nervur.timer';
  }
  class OnKit extends KitContract {
    static override kind = 'com.acme.on-kit';
  }
  abstract class Twin extends Faculty {
    static override kind = 'com.acme.timer';
  }
  class OnTwin extends Twin {
    static override kind = 'com.acme.on-twin';
  }
  class Longer extends Interval {
    static override kind = 'com.acme.longer';
  }
  const of = (...classes: unknown[]) => new Registry([], [acme(...classes)]);
  assert.throws(() => of(Unkinded), /no kind of its own/);
  assert.throws(() => of(Kit), /kind org\.nervur\.mine is outside module com\.acme\.test/);
  assert.throws(() => of(One, Other), /two classes are of kind com\.acme\.one/);
  assert.throws(() => of(OnBare), /Bare declares no kind/);
  assert.throws(() => of(OnKit), /org\.nervur\.timer is the kit's/);
  assert.throws(() => of(Interval, OnTwin), /two contracts are of kind com\.acme\.timer/);
  assert.throws(() => of(Interval, Longer), /com\.acme\.interval is a class and a contract/);
  assert.throws(() => new Registry([], [acme(One), { ...acme(Other), module: 'com.acme.other' }]), /kind com\.acme\.one is in modules com\.acme\.test and com\.acme\.other/, 'across modules');
  const registry = new Registry([], [acme(Interval, Interval, One)]);
  assert.equal(registry.classOf('com.acme.interval'), Interval);
  assert.equal(registry.classOf('com.acme.timer'), undefined);
  assert.equal(registry.classOf('Interval'), undefined);
  assert.deepEqual(registry.kindsOf('com.acme.test'), ['com.acme.interval', 'com.acme.interval', 'com.acme.one']);
  assert.deepEqual(registry.kindsOf('com.acme.none'), []);
  assert.deepEqual(Faculty.contracts(Interval), ['com.acme.interval', 'com.acme.timer']);
});

test(holds('registry.kit-classes', 'kind: a module class extends any class the kit ships, and never one of a kit kind it declares'), () => {
  class OwnCarrier extends CarrierFaculty {
    static override kind = 'com.acme.carrier';
    accepts(): boolean {
      return false;
    }
    dial(): Promise<Dialed> {
      return Promise.resolve(UNDIALED);
    }
  }
  class OwnMemory extends MemoryFaculty {
    static override kind = 'com.acme.memory';
    read(): Promise<Map<string, Uint8Array>> {
      return Promise.resolve(new Map());
    }
    write(): Promise<void> {
      return Promise.resolve();
    }
    places(): Promise<string[]> {
      return Promise.resolve([]);
    }
    forget(): Promise<void> {
      return Promise.resolve();
    }
  }
  class OwnDock extends Dock {
    static override kind = 'com.acme.dock';
  }
  class OwnWard extends Ward {
    static override kind = 'com.acme.ward';
  }
  const registry = new Registry([], [acme(OwnCarrier, OwnMemory, OwnDock, OwnWard)]);
  assert.equal(registry.classOf('com.acme.carrier'), OwnCarrier, 'a contract the kit ships, extended');
  assert.deepEqual(Faculty.contracts(OwnCarrier), ['com.acme.carrier', 'org.nervur.carrier']);
  assert.deepEqual(Faculty.contracts(OwnMemory), ['com.acme.memory', 'org.nervur.memory']);
  assert.equal(registry.classOf('com.acme.dock'), OwnDock);
  abstract class KitWard extends Ward {
    static override kind = 'org.nervur.steward';
  }
  class OnKitWard extends KitWard {
    static override kind = 'com.acme.on-kit-ward';
  }
  assert.throws(() => new Registry([], [acme(OnKitWard)]), /org\.nervur\.steward is the kit's/, 'a ward of a kit kind the kit does not ship');
});

test(holds('module.named-version','kind: a module is named as a kind is, once, with a version, and holds classes alone'), () => {
  const of = (...modules: { module: string; version: string; classes: unknown[] }[]) => new Registry([], modules);
  assert.throws(() => of({ ...acme(), module: 'acme' }), /module acme is no name a module may take/);
  assert.throws(() => of({ ...acme(), module: 'org.nervur.extra' }), /module org\.nervur\.extra is no name/);
  assert.throws(() => of(acme(), acme()), /two modules are named com\.acme\.test/);
  assert.throws(() => of({ ...acme(), version: '' }), /declares no version/);
  assert.throws(() => of(acme('not a class')), /holds something that is no class/);
  class Kit extends Being {
    static override kind = 'org.nervur.kit-only';
  }
  assert.equal(new Registry([Kit], []).classOf('org.nervur.kit-only'), Kit, 'the kit alone stands its own kinds');
});

// A being and her subclass, each standing as its own kind, answering its
// own asks and waking as itself; a lender of a contract, and of a contract
// with no kind of its own; and a timer that fulfils the contract.
const SHOPS = `import { Being, Faculty } from 'nervur';
export const module = 'com.acme.shop';
export const version = '1';
class Timer extends Faculty {
  static kind = 'com.acme.timer';
}
class Interval extends Timer {
  static kind = 'com.acme.interval';
}
class Shop extends Being {
  static kind = 'com.acme.shop';
  static asks = { hello: {} };
  hello() {
    return { shop: 'plain' };
  }
}
class Deli extends Shop {
  static kind = 'com.acme.deli';
  static asks = { hello: {}, slice: {} };
  hello() {
    return { shop: 'deli' };
  }
  slice() {
    return { sliced: true };
  }
}
class Lender extends Being {
  static kind = 'com.acme.lender';
  static asks = { time: {}, bare: {} };
  async time() {
    return { lent: await this.stance.lend(Timer, 't') };
  }
  async bare() {
    class Unkinded extends Timer {}
    return { lent: await this.stance.lend(Unkinded, 'u') };
  }
}
export const classes = [Shop, Deli, Lender, Interval];
`;

// Two modules whose classes share the language's name, Interval, and no
// kind.
const INTERVAL = (module: string, kind: string): string => `import { Faculty } from 'nervur';
export const module = '${module}';
export const version = '1';
class Interval extends Faculty {
  static kind = '${kind}';
}
export const classes = [Interval];
`;

// A harbor whose catalogue runs one module's source.
const run = async (world: World, name: string, source: string): Promise<Harbor> => {
  const harbor = await world.harbor(name);
  const answer = (await add(harbor, source)) as JsonObject;
  assert.equal(answer.version, '1', JSON.stringify(answer));
  return harbor;
};

test(holds('kind.contract-own', 'kind: a subclass stands and wakes as its own kind, and a contract lends only by its own'), async () => {
  const world = new World(TEST);
  const harbor = await run(world, 'h', SHOPS);
  await root(harbor, 'open', { key: 'timer', class: 'com.acme.interval' });
  await root(harbor, 'host', { ward: 'w' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'shop', class: 'com.acme.shop' }, 'w'), { booted: 'shop' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'deli', class: 'com.acme.deli' }, 'w'), { booted: 'deli' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'x', class: 'Deli' }, 'w'), { error: 'no such class' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'l', class: 'com.acme.lender' }, 'w'), { booted: 'l' });
  const again = await world.restart('h');
  const ask = (key: string, method: string) => being(again, key, method, {}, 'w');
  assert.deepEqual(await ask('shop', 'hello'), { shop: 'plain' });
  assert.deepEqual(await ask('deli', 'hello'), { shop: 'deli' });
  assert.deepEqual(await ask('shop', 'slice'), { error: 'unknown ask' });
  assert.deepEqual(await ask('deli', 'slice'), { sliced: true });
  assert.deepEqual(await ask('l', 'time'), { lent: 't' });
  assert.deepEqual(await ask('l', 'bare'), { lent: null });
  assert.deepEqual(Object.values((await census(again, 'w')).beings).map((b) => b.class), ['com.acme.shop', 'com.acme.deli', 'com.acme.lender']);
  assert.equal((await census(again)).class, TestDock.kind);
  assert.equal((await census(again, 'w')).class, TestWard.kind);
});

test(holds('kind.per-harbor', 'kind: two harbors keep their own catalogues, and a class name the language shares collides with nothing'), async () => {
  const world = new World(TEST);
  const a = await run(world, 'a', INTERVAL('com.acme.test', 'com.acme.interval'));
  const b = await run(world, 'b', INTERVAL('net.other.ticks', 'net.other.tick'));
  assert.deepEqual(await root(a, 'open', { key: 't', class: 'com.acme.interval' }), { opened: 't' });
  assert.deepEqual(await root(b, 'open', { key: 't', class: 'net.other.tick' }), { opened: 't' });
  assert.deepEqual(await root(b, 'open', { key: 'u', class: 'com.acme.interval' }), { error: 'no such faculty' }, 'the other harbor holds no such kind');
  const restarted = await world.restart('b');
  assert.deepEqual((await census(restarted)).beings.t, { class: 'net.other.tick', public: false, absent: false }, 'a class the language names Interval, kept as its kind');
});

test(holds('kind.kit-namespace', 'kind: the kit names its own classes under org.nervur, and a catalogue never resolves them'), () => {
  assert.equal(Being.kind, 'org.nervur.being');
  assert.equal(Faculty.kind, 'org.nervur.faculty');
  assert.equal(new Registry([], []).classOf('org.nervur.being'), undefined);
});
