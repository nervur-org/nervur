// Bob's ground on a real device: one house on TCP on every interface,
// naming the public address it is reached at and dialling no private one,
// piloted by its owner through the hand on a local socket. It listens on
// GROUND_PORT, so it comes back where its invitations point. Its first
// line says the house's ward and addresses.
import { ClassList, House, SeedKeys } from 'nervur';
import { FileMemory, serveHand, TcpCarry } from 'nervur/node';
import { Guest } from '../../test/fixtures/world/guest.ts';
import { Host } from '../../test/fixtures/world/host.ts';
import { Steward } from '../../test/fixtures/world/steward.ts';

const port = Number(process.env.GROUND_PORT);
const carry = new TcpCarry({ port, addresses: [`tcp://${process.env.GROUND_HOST}:${port}`] });
const house = await House.open({
  keys: new SeedKeys(process.env.NERVUR_SEED),
  memory: new FileMemory(process.env.GROUND_MEMORY!),
  classes: new ClassList({ steward: Steward, beings: [Host, Guest] }),
  carry,
});
await carry.listen(house);
const hand = await serveHand(house.ask, process.env.GROUND_HAND!);

process.stdout.write(`${JSON.stringify({ ward: house.ward, at: carry.at({}) })}\n`);
process.on('SIGINT', () => void Promise.all([hand.close(), carry.close()]).then(() => process.exit(0)));
