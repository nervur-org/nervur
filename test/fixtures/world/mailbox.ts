// A mail faculty that stands in for SMTP: a being hands it the handle of
// her inbox, and each email that arrives is handed to that ask, its JSON
// body as the args.
import type { FacultyContext, Offer } from 'nervur';
import { need, s } from 'nervur/being';

export const MailBlueprint = need('mail', {
  watch: {
    description: 'Hands every email that arrives to the inbox.',
    args: s.object({ inbox: s.handle() }),
    hints: { idempotent: true },
  },
  latest: {
    description: 'The paper of the last email kept for collection.',
    result: s.object({ invitation: s.handle() }),
    hints: { readOnly: true, idempotent: true },
  },
});

export class Mailbox {
  #inbox: { token: string; context: FacultyContext } | undefined;
  #received = 0;

  async watch({ inbox }: { inbox: string }, context: FacultyContext) {
    this.#inbox = { token: inbox, context };
    return { result: null };
  }

  #kept: string | undefined;

  async latest() {
    return this.#kept === undefined ? { error: { message: 'no email is kept' } } : { result: { invitation: this.#kept } };
  }

  /** An email is kept for collection, not handed to the inbox. */
  keep(body: string) {
    this.#kept = (JSON.parse(body) as { invitation: string }).invitation;
  }

  /** An email arrived: its body is JSON, handed to the inbox as it stands. */
  arrive(body: string) {
    if (this.#inbox === undefined) throw new Error('no inbox watches this mailbox');
    this.#received += 1;
    return this.#inbox.context.call({ token: this.#inbox.token, args: JSON.parse(body), id: `mail:${this.#received}` });
  }
}

export const mailOffer = (mailbox: Mailbox): Offer => ({ blueprint: MailBlueprint, object: mailbox });
