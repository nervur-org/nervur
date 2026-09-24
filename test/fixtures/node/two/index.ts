// Ground two's folder of code: its steward, hosts who greet, and guests who
// hold a standing on a host.
export { Steward as steward } from '../../world/steward.ts';
import { Guest } from '../../world/guest.ts';
import { Host } from '../../world/host.ts';

export const beings = [Host, Guest];
