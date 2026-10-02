// Two faculties, one calling the other through its entry's `faculties`: a
// post that keeps what it is sent, and a bell whose ring sends a line
// through the post its entry names. Each notes its `up`, so a test reads
// the ladder's order.
import { Faculty, OK, type FacultyClass, type Status } from 'nervur';
import { need, s } from 'nervur/being';

export const PostBlueprint = need('post', {
  send: { args: s.object({ line: s.string() }), idempotent: true },
  sent: { result: s.array(s.string()), readOnly: true },
});

export const BellBlueprint = need('bell', {
  ring: { args: s.object({ who: s.string() }), idempotent: true },
});

/** The registry, and every `up` in the order the ground raised them. */
export const chain = () => {
  const ups: string[] = [];
  const lines: string[] = [];
  class Post extends Faculty {
    static override readonly blueprint = PostBlueprint;
    override up(): Status {
      ups.push(this.made.name);
      return OK;
    }
    async send({ line }: { line: string }) {
      lines.push(line);
      return { result: null };
    }
    async sent() {
      return { result: [...lines] };
    }
  }
  class Bell extends Faculty {
    static override readonly blueprint = BellBlueprint;
    override up(): Status {
      ups.push(this.made.name);
      return OK;
    }
    async ring({ who }: { who: string }) {
      const sent = await this.made.call({ faculty: 'post', method: 'send', args: { line: `${who} rang` } });
      return 'error' in sent ? sent : { result: null };
    }
  }
  const faculties: Record<string, FacultyClass> = { post: Post, bell: Bell };
  return { ups, lines, registry: { faculties } };
};
