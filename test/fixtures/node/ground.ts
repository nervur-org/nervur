// A ground written by hand, as an owner may write one: its seed from the
// environment, one house on a file, and TCP. It prints the house's ward
// and, where asked, an invitation to its steward's occupant `far`, so a
// test can ask it.
import { ClassList, Ground, SeedKeys } from 'nervur';
import { FileMemory, TcpCarry } from 'nervur/node';
import { Steward } from '../world/steward.ts';

const carry = new TcpCarry({ port: Number(process.env.GROUND_PORT ?? 0), host: '127.0.0.1', allowPrivate: true });
const ground = await Ground.open({
  custody: { keys: () => new SeedKeys(process.env.NERVUR_SEED) },
  memory: new FileMemory(`${process.env.GROUND_MEMORY!}.record`),
  carry,
  bodies: {
    memory: { file: () => new FileMemory(process.env.GROUND_MEMORY!) },
    classes: { steward: () => new ClassList({ steward: Steward }) },
  },
});
const { ward } = await ground.add('main', { memory: { body: 'file' }, classes: { body: 'steward' } });

const offered = process.env.GROUND_OFFER === '1' ? await ground.ask({ house: 'main', method: 'offer' }) : null;
process.stdout.write(`${JSON.stringify({ ward, offered })}\n`);
process.on('SIGINT', () => void ground.close().then(() => carry.close()).then(() => process.exit(0)));
