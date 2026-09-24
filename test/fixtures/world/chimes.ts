// Chimes: she hands a bell a handle on her `rang`, and asks a knocker,
// another faculty, to knock. The test lets the knocker hold the bell's
// token, so what a token answers a faculty it was not handed to is read.
// Ring and knock are effects, so each calls back once her ask has landed.
import { Being, s, need, type Args } from 'nervur/being';

export const Bell = need('bell', {
  watch: { args: s.object({ inbox: s.handle() }), hints: { idempotent: true } },
  ring: {},
});

export const Knocker = need('knocker', { knock: { result: s.string() } });

export class Chimes extends Being.of({
  kind: 'org.example.chimes',
  needs: { bell: Bell, knocker: Knocker },
  cells: { rings: 0, knocked: '' },
  asks: {
    arm: { hints: { idempotent: true } },
    ring: {},
    knock: {},
    knocked: { args: s.reply(Knocker.knock) },
    rang: { for: 'handle' },
    rings: { hints: { readOnly: true }, result: s.integer() },
    heard: { hints: { readOnly: true }, result: s.string() },
  },
}) {
  async arm() {
    await this.bell.watch({ inbox: this.handle('rang') });
  }

  ring() {
    this.bell.ring({});
  }

  knock() {
    this.knocker.knock({}, { reply: 'knocked' });
  }

  knocked(reply: Args<Chimes, 'knocked'>) {
    this.cells.knocked = 'error' in reply && reply.error !== undefined ? reply.error.message : (reply.result ?? '');
  }

  rang() {
    this.cells.rings += 1;
  }

  rings() {
    return this.cells.rings;
  }

  heard() {
    return this.cells.knocked;
  }
}
