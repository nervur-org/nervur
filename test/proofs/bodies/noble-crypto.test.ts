import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { cryptoSuite } from '../../suites/crypto.ts';

cryptoSuite('NobleCrypto', () => new NobleCrypto());
