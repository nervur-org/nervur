// The clock and the carry a ground hands each house are bodies of their
// contracts like any other, and held to the same suites.
import { FakeNetwork } from 'nervur/bench';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { HouseCarry, HouseClock } from '../../../src/ground/ground.ts';
import { carrySuite } from '../../suites/carry.ts';
import { clockSuite } from '../../suites/clock.ts';

clockSuite('HouseClock', () => {
  const clock = new FakeClock();
  return { clock: new HouseClock(clock, 'shop'), advance: async (ms) => clock.advance(ms) };
});

carrySuite('HouseCarry', async () => {
  const network = new FakeNetwork();
  const two = network.join('two', { names: ['two.example'] });
  return {
    one: new HouseCarry(network.join('one')),
    two: new HouseCarry(two),
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
