// Alice as a collector of papers, taking one each way a paper can cross
// into a being: in her ask's args from a faculty, in the result of her call
// to a faculty, and in the reply of her effect to a far being.
import { Being, need, s, type Args } from 'nervur/being';
import { BellBlueprint } from './bell.ts';
import { Hosted } from './host.ts';
import { MailBlueprint } from './mailbox.ts';

/** What she asks Bob for: a new door on him. */
export const Doors = need('doors', {
  door: { result: s.object({ handle: s.handle() }) },
});

export class Collector extends Being.of({
  kind: 'org.example.collector',
  needs: { mail: MailBlueprint, bell: BellBlueprint },
  cells: { onBob: '', fromMail: '', fromResult: '', fromReply: '' },
  asks: {
    born: {},
    // Bob's paper, handed by her owner.
    accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    // A faculty hands her a paper in her ask's args.
    take: { for: 'handle', args: s.object({ invitation: s.handle() }) },
    // She calls a faculty, and its result carries a paper. Taking it is safe to repeat.
    fetch: { hints: { idempotent: true } },
    // She asks Bob for a door, and his answer reaches her reply.
    askDoor: {},
    gotDoor: { args: s.reply(Doors.door) },
    greetMail: { hints: { readOnly: true, idempotent: true }, result: s.string() },
    greetResult: { hints: { readOnly: true, idempotent: true }, result: s.string() },
    greetReply: { hints: { readOnly: true, idempotent: true }, result: s.string() },
  },
}) {
  async born() {
    await this.mail.watch({ inbox: this.handle('take') });
  }

  accept({ invitation }: Args<Collector, 'accept'>) {
    this.cells.onBob = invitation;
  }

  take({ invitation }: Args<Collector, 'take'>) {
    this.cells.fromMail = invitation;
  }

  async fetch() {
    this.cells.fromResult = (await this.mail.latest({})).invitation;
  }

  askDoor() {
    this.held(this.cells.onBob, Doors).door({}, { reply: 'gotDoor' });
  }

  gotDoor(answer: Args<Collector, 'gotDoor'>) {
    if (answer.result !== undefined) this.cells.fromReply = answer.result.handle;
    this.bell.ring({});
  }

  greetMail() {
    return this.held(this.cells.fromMail, Hosted).greet({});
  }

  greetResult() {
    return this.held(this.cells.fromResult, Hosted).greet({});
  }

  greetReply() {
    return this.held(this.cells.fromReply, Hosted).greet({});
  }
}
