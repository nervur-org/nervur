// Two faculties, one calling the other through its entry's `faculties`: a
// post that keeps what it is sent, and a bell whose ring sends a line
// through the post it was handed. Each notes its `up`, so a test reads the
// ladder's order.
import type { Faculty } from 'nervur';
import { need, s } from 'nervur/being';

export const PostBlueprint = need('post', {
  send: { args: s.object({ line: s.string() }), hints: { idempotent: true } },
  sent: { result: s.array(s.string()), hints: { readOnly: true } },
});

export const BellBlueprint = need('bell', {
  ring: { args: s.object({ who: s.string() }), hints: { idempotent: true } },
});

type Post = { send(args: { line: string }): Promise<{ result: null }> };

/** The registry, and every `up` in the order the ground raised them. */
export const chain = () => {
  const ups: string[] = [];
  const lines: string[] = [];
  const faculties: Record<string, Faculty> = {
    post: {
      up: ({ name }) => {
        ups.push(name);
        return {
          blueprint: PostBlueprint,
          object: {
            send: async ({ line }: { line: string }) => (lines.push(line), { result: null }),
            sent: async () => ({ result: [...lines] }),
          },
        };
      },
    },
    bell: {
      up: ({ name, faculties: called }) => {
        ups.push(name);
        const post = called.post as Post;
        return { blueprint: BellBlueprint, object: { ring: ({ who }: { who: string }) => post.send({ line: `${who} rang` }) } };
      },
    },
  };
  return { ups, lines, registry: { faculties } };
};
