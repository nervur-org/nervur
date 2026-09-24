// A mailer: she sends mail through the ground's mail faculty by an effect,
// and keeps each reply she hears.
import { Being, need, s, type Args } from 'nervur/being';

export const Mail = need('mail', {
  send: { args: s.object({ to: s.string() }), result: s.string() },
});

export class Mailer extends Being.of({
  kind: 'org.example.mailer',
  needs: { mail: Mail },
  cells: { sent: [] as string[], failed: [] as string[], count: 0 },
  asks: {
    notify: { args: s.object({ to: s.string() }) },
    sent: { args: s.reply(Mail.send) },
    count: { args: s.object({ by: s.number() }) },
    log: { hints: { readOnly: true }, result: s.object({ sent: s.array(s.string()), failed: s.array(s.string()), count: s.number() }) },
  },
}) {
  notify({ to }: Args<Mailer, 'notify'>) {
    this.mail.send({ to }, { reply: 'sent' });
  }

  sent({ result, error }: Args<Mailer, 'sent'>) {
    if (error === undefined) this.cells.sent = [...this.cells.sent, result];
    else this.cells.failed = [...this.cells.failed, error.message];
  }

  count({ by }: Args<Mailer, 'count'>) {
    this.cells.count += by;
  }

  log() {
    return this.cells;
  }
}
