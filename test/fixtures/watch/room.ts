// A chat room on a station: occupants post and read, and a handle to its
// messages is the door a device watches through, a relation of its own.
import { Being, s, need, type Args } from 'nervur/being';

export const Message = s.object({ from: s.string(), text: s.string() });

/** What a reader watches: the room's messages, and nothing else. */
export const Messages = need('messages', {
  messages: { hints: { readOnly: true }, result: s.array(Message) },
});

/** What a member calls: the messages, and a post, which is an effect. */
export const Chat = need('chat', {
  messages: { hints: { readOnly: true }, result: s.array(Message) },
  post: { args: s.object({ text: s.string() }) },
});

export class Room extends Being.of({
  kind: 'org.example.room',
  description: 'A room where occupants talk.',
  view: '<nv-feed ask="messages"></nv-feed><form ask="post"></form>',
  cells: { messages: [] as { from: string; text: string }[], topic: '' },
  roles: { member: (asker) => asker.id !== 'stranger' },
  asks: {
    post: { for: 'member', args: s.object({ text: s.string() }) },
    retitle: { for: 'member', args: s.object({ topic: s.string() }) },
    messages: { for: ['member', 'handle'], hints: { readOnly: true }, result: s.array(Message) },
    door: { for: 'member', result: s.object({ handle: s.handle() }) },
  },
}) {
  post({ text }: Args<Room, 'post'>) {
    this.cells.messages = [...this.cells.messages, { from: this.asker.id, text }];
  }

  retitle({ topic }: Args<Room, 'retitle'>) {
    this.cells.topic = topic;
  }

  messages() {
    return this.cells.messages;
  }

  door() {
    return { handle: this.handle('messages') };
  }
}
