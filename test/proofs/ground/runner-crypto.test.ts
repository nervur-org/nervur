// The crypto a runner hands its house: WebCrypto in its own thread, and the
// curves and the lattice asked of the ground's side, here a NobleCrypto.
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { RunnerCrypto } from '../../../src/ground/inside.ts';
import { cryptoSuite } from '../../suites/crypto.ts';

const ground = new NobleCrypto() as unknown as Record<string, (...values: unknown[]) => Promise<unknown>>;

cryptoSuite('RunnerCrypto', () => new RunnerCrypto(undefined, (method, args) => ground[method](...args)));
cryptoSuite('RunnerCrypto seeded', () => new RunnerCrypto('7'.repeat(64), (method, args) => ground[method](...args)));
