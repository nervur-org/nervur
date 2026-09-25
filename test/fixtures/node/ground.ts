// A ground written by hand, as an owner may write one: its key from the
// environment, its drawer on one file and one house on another, and TCP.
// It prints the house's ward and, where asked, an invitation to its
// steward's occupant `far`, so a test can ask it.
import { ClassList, Ground } from 'nervur';
import { FileMemory, TcpCarry } from 'nervur/node';
import { Steward } from '../world/steward.ts';

const carry = new TcpCarry({ port: Number(process.env.GROUND_PORT ?? 0), host: '127.0.0.1', allowPrivate: true });
const ground = await Ground.open({
  registry: {
    faculties: {
      'env-unlock': { up: () => ({ serves: 'unlock', object: { key: async () => process.env.NERVUR_KEY ?? '' } }) },
      drawer: { up: () => ({ serves: 'memory', object: new FileMemory(`${process.env.GROUND_MEMORY!}.drawer`) }) },
      tcp: { up: () => ({ serves: 'carry', schemes: ['tcp'], object: carry, down: () => carry.close() }) },
      file: { up: () => ({ serves: 'memory', house: () => new FileMemory(process.env.GROUND_MEMORY!) }) },
      steward: { up: () => ({ serves: 'classes', house: () => new ClassList({ steward: Steward }) }) },
    },
  },
  primordial: { unlock: { make: 'env-unlock' }, memory: { make: 'drawer' }, crypto: { make: 'noble' }, tools: { make: 'strict' } },
  entries: { clock: { make: 'clock' }, tcp: { make: 'tcp' }, file: { make: 'file' }, steward: { make: 'steward' } },
});
const { ward } = await ground.add('main', { memory: { faculty: 'file' }, classes: { faculty: 'steward' } });

const offered = process.env.GROUND_OFFER === '1' ? await ground.ask({ house: 'main', method: 'offer' }) : null;
process.stdout.write(`${JSON.stringify({ ward, offered })}\n`);
process.on('SIGINT', () => void ground.close().then(() => process.exit(0)));
