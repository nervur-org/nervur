// SPDX-License-Identifier: Apache-2.0
// The suites of the bodies, Custody, Memory, Entropy and Loader, as scenes
// with no platform under them, so Node's runner, every engine and a
// stranger's own runner hold a body to the same assertions.
import { Custody, Entropy, Loader, Memory } from '../contract/index.ts';
import type { Expect } from './expect.ts';

export type Scene = [string, () => Promise<void>];

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
// A place as plain values, in name order, so two can be compared as JSON.
const plain = (place: ReadonlyMap<string, Uint8Array>): [string, number[]][] => [...place].map(([n, b]): [string, number[]] => [n, [...b]]).sort(([a], [b]) => (a < b ? -1 : 1));

// `make` gives two bodies over one keeping, as two runs would build them,
// and a fresh keeping each call.
export const custodyScenes = (name: string, make: () => [Custody, Custody], expect: Expect): Scene[] => [
  [
    `[contract] ${name} fulfils Custody: one seed of thirty-two bytes, the same every time`,
    async () => {
      const [custody, again] = make();
      expect.ok(custody instanceof Custody);
      const seed = await custody.seed();
      expect.equal(seed.length, 32);
      const first = [...seed];
      seed.fill(0);
      expect.same([...(await custody.seed())], first, 'a seed handed out is a copy');
      expect.same([...(await again.seed())], first, 'another body over the keeping holds the same');
      expect.ok([...(await make()[0].seed())].join() !== first.join(), 'another keeping holds another seed');
      const [fresh, rival] = make();
      const [a, b] = await Promise.all([fresh.seed(), rival.seed()]);
      expect.same([...a], [...b], 'two first asks at once keep one seed');
    },
  ],
];

// `cut` is a body whose next keep stops partway, as a run that dies inside
// one does, and `fresh` the memory a new run opens on the same keeping. A
// body no crash can cut short, holding its places in one object, names
// none.
export type Cut = { cut: Memory; fresh: Memory };

export const memoryScenes = (name: string, make: () => [Memory, Memory], expect: Expect, half?: () => Cut): Scene[] => [
  [
    `[contract] ${name} fulfils Memory: it names its places, and forgets one whole`,
    async () => {
      const [memory, again] = make();
      expect.same(await memory.places(), []);
      await memory.write('aa', new Map([['01', bytes(1)]]));
      await memory.write('bb', new Map([['01', bytes(2)], ['02', bytes(3)]]));
      expect.same([...(await again.places())].sort(), ['aa', 'bb']);
      await memory.forget('aa');
      expect.same(await again.places(), ['bb']);
      expect.same(plain(await again.read('aa')), []);
      await memory.forget('aa');
      await memory.write('bb', new Map([['01', null], ['02', null]]));
      expect.same(await again.places(), [], 'a place holding nothing is no place');
    },
  ],
  ...(half
    ? [
        [
          `[contract] ${name} fulfils Memory: a keep that stops partway is whole or is nothing`,
          async () => {
            const { cut, fresh } = half();
            await cut.write('aa', new Map([['01', bytes(1)], ['02', bytes(2)]])).catch(() => undefined);
            const before = plain(await fresh.read('aa'));
            await cut.write('aa', new Map([['01', bytes(9)], ['02', null], ['03', bytes(3)]])).catch(() => undefined);
            const after = JSON.stringify(plain(await fresh.read('aa')));
            const whole = JSON.stringify(plain(new Map([['01', bytes(9)], ['03', bytes(3)]])));
            expect.ok(after === JSON.stringify(before) || after === whole, `a keep cut short left ${after}`);
          },
        ] satisfies Scene,
      ]
    : []),
  [
    `[contract] ${name} fulfils Memory: a place read again holds what was kept, and nothing else`,
    async () => {
      const [memory, again] = make();
      expect.ok(memory instanceof Memory);
      expect.same(plain(await memory.read('aa')), []);
      const written = bytes(1, 2, 3);
      await memory.write('aa', new Map([['01', written], ['02', bytes(4)]]));
      written[0] = 9;
      await memory.write('bb', new Map([['01', bytes(5)]]));
      await memory.write('aa', new Map([['02', null], ['03', bytes()], ['04', null]]));
      const read = await again.read('aa');
      expect.same(plain(read), [['01', [1, 2, 3]], ['03', []]]);
      expect.ok(read.get('01') instanceof Uint8Array, 'an entry is bytes');
      read.get('01')![0] = 7;
      expect.same([...(await memory.read('aa')).get('01')!], [1, 2, 3], 'an entry handed out is a copy');
      expect.same(plain(await again.read('bb')), [['01', [5]]]);
      expect.same(plain(await again.read('cc')), []);
    },
  ],
];

export const entropyScenes = (name: string, make: () => Entropy, expect: Expect): Scene[] => [
  [
    `[contract] ${name} fulfils Entropy: bytes of the length asked, never the same twice`,
    () => {
      const entropy = make();
      expect.ok(entropy instanceof Entropy);
      expect.equal(entropy.draw(0).length, 0);
      expect.equal(entropy.drawer(33).length, 33);
      expect.ok([...entropy.draw(32)].join() !== [...entropy.draw(32)].join(), 'two draws differ');
      return Promise.resolve();
    },
  ],
];

// A module's source as bytes and its blob's git id, the two things a
// loader is handed.
export type Source = { source: string; id: string };

// `make` gives a loader, a module's source it runs, and a source it
// refuses: one that does not load, or, for a bundle, one it does not carry.
export const loaderScenes = (name: string, make: () => { loader: Loader; found: Source; refused: Source }, expect: Expect): Scene[] => [
  [
    `[contract] ${name} fulfils Loader: a module's source becomes that module, the same again, and a source it cannot run throws`,
    async () => {
      const { loader, found, refused } = make();
      expect.ok(loader instanceof Loader);
      const loaded = await loader.load(found.source, found.id);
      expect.equal(typeof loaded.module, 'string');
      expect.equal(typeof loaded.version, 'string');
      expect.ok(Array.isArray(loaded.classes) && loaded.classes.length > 0 && loaded.classes.every((C) => typeof C === 'function'), 'the classes are classes');
      const again = await loader.load(found.source, found.id);
      expect.same({ module: again.module, version: again.version }, { module: loaded.module, version: loaded.version });
      let said = '';
      await loader.load(refused.source, refused.id).catch((e: Error) => (said = e.message));
      expect.ok(said !== '', 'a source it cannot run throws, saying why');
    },
  ],
];
