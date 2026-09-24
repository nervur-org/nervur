// A reader on a device: she takes a room's door and follows its messages
// by a watch, inside a readOnly ask of her own, so she stays free to answer.
import { Being, s, type Args } from 'nervur/being';
import { Chat, Message, Messages } from './room.ts';

export class Reader extends Being.of({
  kind: 'org.example.reader',
  cells: { room: '' },
  roles: { owner: (asker) => asker.id === 'root' },
  asks: {
    take: { for: 'owner', hints: { idempotent: true }, args: s.object({ invitation: s.handle() }) },
    follow: { for: 'owner', wait: 60_000, hints: { readOnly: true }, args: s.object({ after: s.array(Message) }), result: s.array(Message) },
    push: { for: 'owner', args: s.object({ text: s.string() }) },
  },
}) {
  take({ invitation }: Args<Reader, 'take'>) {
    this.cells.room = invitation;
  }

  follow({ after }: Args<Reader, 'follow'>) {
    return this.held(this.cells.room, Messages).messages({}, { after });
  }

  // A watch on an ask that is not readOnly is refused where she makes it.
  push({ text }: Args<Reader, 'push'>) {
    // The types refuse `after` on an effect, so only a cast reaches the house's own refusal.
    const room = this.held(this.cells.room, Chat) as unknown as Record<string, (args: object, options: object) => unknown>;
    room.post({ text }, { after: [] });
  }
}
