// A ground written by hand, as an owner may write one: its key from the
// environment, its dock on one file and one house on another, and TCP.
// It prints the house's ward and, where asked, an invitation to its
// steward's occupant `far`, so a test can ask it.
import { Carry, Classes, ClassList, Ground, Memory, Unlock } from 'nervur';
import { FileMemory, TcpCarry } from 'nervur/node';
import { serving } from '../serving.ts';
import { Steward } from '../world/steward.ts';

const carry = new TcpCarry({ port: Number(process.env.GROUND_PORT ?? 0), host: '127.0.0.1', allowPrivate: true });
const ground = await Ground.open({
  registry: {
    faculties: {
      'env-unlock': serving(Unlock, () => ({ key: async () => process.env.NERVUR_KEY ?? '' })),
      ledger: serving(Memory, () => new FileMemory(`${process.env.GROUND_MEMORY!}.ledger`)),
      tcp: serving(Carry, () => carry, { schemes: ['tcp'], down: () => carry.close() }),
      file: serving(Memory, undefined, { house: () => new FileMemory(process.env.GROUND_MEMORY!) }),
      steward: serving(Classes, undefined, { house: () => new ClassList({ steward: Steward }) }),
    },
  },
  primordial: { unlock: { make: 'env-unlock' }, memory: { make: 'ledger' }, crypto: { make: 'noble' }, tools: { make: 'strict' }, clock: { make: 'clock' } },
  entries: { tcp: { make: 'tcp' }, file: { make: 'file' }, steward: { make: 'steward' } },
});
const { ward } = await ground.add('main', { memory: { faculty: 'file' }, classes: { faculty: 'steward' } });

const offered = process.env.GROUND_OFFER === '1' ? await ground.ask({ house: 'main', method: 'offer' }) : null;
process.stdout.write(`${JSON.stringify({ ward, offered })}\n`);
process.on('SIGINT', () => void ground.close().then(() => process.exit(0)));
