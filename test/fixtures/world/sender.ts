// A sender: each ask posts one numbered effect, and every reply that comes
// back is kept in the order it came.
import { Being, s, need, type Args } from 'nervur/being';

/** A post office: one effect a letter. */
export const Post = need('post', { send: { args: s.object({ n: s.number() }) } });

export class Sender extends Being.of({
  kind: 'org.example.sender',
  needs: { post: Post },
  cells: { replies: [] as string[] },
  asks: {
    go: { args: s.object({ n: s.number() }) },
    sent: { args: s.reply(Post.send) },
    replies: { hints: { readOnly: true }, result: s.array(s.string()) },
  },
}) {
  go({ n }: Args<Sender, 'go'>) {
    this.post.send({ n }, { reply: 'sent' });
  }

  sent(reply: Args<Sender, 'sent'>) {
    this.cells.replies = [...this.cells.replies, 'error' in reply && reply.error !== undefined ? reply.error.message : 'sent'];
  }

  replies() {
    return this.cells.replies;
  }
}
