// A class that keeps a handle where no house sees it, in its module, and
// later answers it from whichever house asks. A house knows only the
// handles it minted, so one smuggled in from another house is no handle.
import { Being, s } from 'nervur/being';
import { Steward } from './steward.ts';

let smuggled: unknown;

export class Smuggler extends Being.of({
  kind: 'org.example.smuggler',
  asks: {
    keep: { for: 'root' },
    pass: { for: 'root', result: s.object({ handle: s.handle() }) },
    ping: { for: 'handle' },
  },
}) {
  keep() {
    smuggled = this.handle('ping');
  }

  pass() {
    return { handle: smuggled as never };
  }

  ping() {}
}

export const steward = Steward;
export const beings = [Smuggler];
