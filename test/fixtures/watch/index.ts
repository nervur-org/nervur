// The house module of a chat: the test steward, a room and a reader.
import { Steward } from '../world/steward.ts';
import { Reader } from './reader.ts';
import { Room } from './room.ts';

export const steward = Steward;
export const beings = [Room, Reader];
