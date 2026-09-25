// Every fake the bench exports, held to its contract's suite.
import { FakeNetwork } from 'nervur/bench';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { SeededCrypto } from '../../../src/bench/seeded.ts';
import { carrySuite } from '../../suites/carry.ts';
import { clockSuite } from '../../suites/clock.ts';
import { cryptoSuite } from '../../suites/crypto.ts';
import { memorySuite } from '../../suites/memory.ts';

memorySuite('FakeMemory', () => new FakeMemory());

// Every house of a BenchGround seals with it: its randomness drawn from a seed, and the rest noble's.
cryptoSuite('SeededCrypto', () => new SeededCrypto('suite'));

// The carry every BenchGround joins: names as DNS gives them, and a reply lost where the test says.
carrySuite('FakeNetwork', async () => {
  const network = new FakeNetwork();
  const two = network.join('two', { names: ['two.example'] });
  return {
    one: network.join('one'),
    two,
    listen: async (listened) => two.listen(listened),
    nowhere: 'bench://nowhere.example',
    cut: async () => network.loseNext(),
    spare: async () => {
      let reached = false;
      const three = network.join('three', { names: ['three.example'] });
      three.listen({
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

clockSuite('FakeClock', () => {
  const clock = new FakeClock();
  return { clock, advance: async (ms) => clock.advance(ms) };
});

