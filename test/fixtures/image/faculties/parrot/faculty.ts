// The parrot: one faculty of an installed library, which says back what it
// is told after the prefix its entry's args give.
import { Faculty } from 'nervur';
import { need, s } from 'nervur/being';

export const Voice = need('org.example.voice', {
  say: { args: s.object({ text: s.string() }), result: s.string(), readOnly: true },
});

export class Parrot extends Faculty {
  static override readonly blueprint = Voice;
  static override readonly takes = { args: s.object({ prefix: s.optional(s.string()) }) };
  async say({ text }: { text: string }) {
    return { result: `${String(this.made.args.prefix ?? '')}${text}` };
  }
}
