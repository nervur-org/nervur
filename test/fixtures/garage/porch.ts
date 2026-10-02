// The porch: she arms the doorbell with a handle on her `rang`, and counts
// every ring the bell calls back.
import { Being, need, s } from 'nervur/being';
import { Steward } from './steward.ts';

const Doorbell = need('doorbell', {
  watch: { args: s.object({ inbox: s.handle() }), idempotent: true },
  press: {},
});

export class Porch extends Being.of({
  kind: 'org.example.porch',
  needs: { bell: Doorbell },
  cells: { rings: 0 },
  asks: {
    arm: { idempotent: true },
    press: {},
    rang: { for: 'handle' },
    rings: { readOnly: true, result: s.integer() },
  },
}) {
  async arm() {
    const { error } = await this.bell.watch({ inbox: this.handle('rang') });
    if (error) this.fail(error.message);
  }

  press() {
    this.bell.press({});
  }

  rang() {
    this.cells.rings += 1;
  }

  rings() {
    return this.cells.rings;
  }
}

export const steward = Steward;
export const beings = [Porch];
