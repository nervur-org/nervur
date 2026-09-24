// JoinedCarry: several carries as one, held to the carry suite, and to
// sending each address by the carry of its scheme.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JoinedCarry, type Carry } from 'nervur';
import { FakeNetwork } from 'nervur/bench';
import type { Door } from '../../../src/ground/ground.ts';
import { carrySuite } from '../../suites/carry.ts';

// A join of one carry keeps the contract whole.
carrySuite('JoinedCarry', async () => {
  const network = new FakeNetwork();
  const two = network.join('two', { names: ['two.example'] });
  return {
    one: new JoinedCarry({ bench: network.join('one') }),
    two: new JoinedCarry({ bench: two }),
    listen: async (listened) => two.listen(listened),
    nowhere: 'bench://nowhere.example',
    cut: async () => network.loseNext(),
    spare: async () => {
      let reached = false;
      network.join('three', { names: ['three.example'] }).listen({
        ward: 'ab'.repeat(64),
        door: async () => {
          reached = true;
          return new Uint8Array([9]);
        },
      });
      return { at: 'bench://three.example', reached: () => reached };
    },
    // The box reaches its door first, and then the network's clock moves past its wait.
    pass: async (ms) => {
      await network.settle();
      await network.advance(ms);
    },
    close: async () => undefined,
  };
});

// A carry of one scheme, known at `address`: the doors at the addresses it
// dials, each address it dialled, and a reply it loses when told.
const scheme = (address: string, doors = new Map<string, Door>()) => {
  const tried: string[] = [];
  let lose = 0;
  const carry: Carry = {
    at: () => [address],
    // The domain of its one address vouches, so a joined carry's union is seen.
    vouched: ({ at }) => Promise.resolve(at.includes(address) ? [new URL(address).hostname] : []),
    send: async ({ at, box }) => {
      for (const to of at) {
        const door = doors.get(to);
        if (door === undefined) continue;
        tried.push(to);
        const reply = await door(box);
        if (lose > 0) {
          lose--;
          return { reply: null, heard: true };
        }
        if (reply !== null) return { reply, via: to };
      }
      return { reply: null, heard: false };
    },
  };
  return { carry, doors, tried, lose: () => void lose++ };
};

const ward = 'ab'.repeat(64);
const box = new Uint8Array([1]);

test('JoinedCarry names every carry’s addresses, and sends each address by the carry of its scheme, in order', async () => {
  const tcp = scheme('tcp://shop:7000');
  const web = scheme('https://shop/quo');
  const joined = new JoinedCarry({ tcp: tcp.carry, https: web.carry });
  assert.deepEqual(joined.at({}), ['tcp://shop:7000', 'https://shop/quo']);

  web.doors.set('https://shop/quo', async () => new Uint8Array([2]));
  assert.deepEqual(await joined.send({ ward, at: ['tcp://shop:7000', 'https://shop/quo'], box }), { reply: new Uint8Array([2]), via: 'https://shop/quo' }, 'the tcp address did not hear, so the web one was tried');
  assert.deepEqual(await joined.send({ ward, at: ['ws://unspoken/quo'], box }), { reply: null, heard: false }, 'a scheme no carry speaks is passed');
  assert.equal((await joined.send({ ward, at: ['HTTPS://shop/quo'], box })).reply !== null, false, 'the web carry knows only its own spelling');
  web.doors.set('HTTPS://shop/quo', async () => new Uint8Array([4]));
  assert.deepEqual(await joined.send({ ward, at: ['HTTPS://shop/quo'], box }), { reply: new Uint8Array([4]), via: 'HTTPS://shop/quo' }, 'a scheme is read in any case');
});

test('JoinedCarry carries a box that may have been heard over one carry to no address of another', async () => {
  const tcp = scheme('tcp://shop:7000', new Map([['tcp://shop:7000', async () => new Uint8Array([3])]]));
  const web = scheme('https://shop/quo', new Map([['https://shop/quo', async () => new Uint8Array([2])]]));
  const joined = new JoinedCarry({ tcp: tcp.carry, https: web.carry });
  tcp.lose();
  assert.deepEqual(await joined.send({ ward, at: ['tcp://shop:7000', 'https://shop/quo'], box }), { reply: null, heard: true });
  assert.deepEqual(web.tried, []);
});
