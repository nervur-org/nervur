// A shop's house module, as its folder's index exports it: a steward the
// owner pilots, hosts who greet their guests, and guests who hold a
// standing elsewhere.
import { Guest } from './guest.ts';
import { Host } from './host.ts';
import { Steward } from './steward.ts';
import { Sender, Tally } from './ledger.ts';

export const steward = Steward;
export const beings = [Host, Guest, Tally, Sender];
