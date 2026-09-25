// A faculty that declares what it takes: a mail whose entry names a port
// and may name a host, and names the secret it signs with. What it takes
// is read from `held`, so a test moves the code beneath a drawer that
// keeps the entry.
import type { Faculty, Takes } from 'nervur';
import { s } from 'nervur/being';

export const TAKES: Takes = {
  args: s.object({ port: s.integer({ minimum: 0, maximum: 65_535 }), host: s.optional(s.string()) }),
  secrets: { 'mail-key': 'the key the mail signs with' },
};

/** The registry, and what its mail takes now. */
export const taking = () => {
  const held: { takes: Takes } = { takes: TAKES };
  const mail: Faculty = {
    get takes() {
      return held.takes;
    },
    up: () => ({}),
  };
  return { held, registry: { faculties: { mail } } };
};
