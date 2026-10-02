// A faculty that declares what it takes: a mail whose entry names a port
// and may name a host, and the secret it signs with, which its `up`
// reads. What it takes is read from `held`, so a test moves the code
// beneath a dock that keeps the entry.
import { Faculty, OK, type FacultyClass, type Status, type Takes } from 'nervur';
import { need, s } from 'nervur/being';

export const TAKES: Takes = {
  args: s.object({ port: s.integer({ minimum: 0, maximum: 65_535 }), host: s.optional(s.string()) }),
  secrets: { 'mail-key': 'the key the mail signs with' },
};

/** The registry, what its mail takes now, and each key its mail went up on. */
export const taking = () => {
  const held: { takes: Takes } = { takes: TAKES };
  const signed: string[] = [];
  class Mail extends Faculty {
    static override readonly blueprint = need('org.example.mail', {});
    static override get takes(): Takes {
      return held.takes;
    }
    override up(): Status {
      signed.push(this.made.secrets['mail-key']);
      return OK;
    }
  }
  const mail: FacultyClass = Mail;
  return { held, signed, registry: { faculties: { mail } } };
};
