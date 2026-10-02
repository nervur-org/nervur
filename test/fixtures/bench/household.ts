// A house module of two beings that each await the other: ping awaits
// pong, and pong awaits ping's back while ping still waits. A household
// walk finds the call that comes back to a being in its own chain.
import { Being, need, s } from 'nervur/being';

const Ponged = need('ponged', { pong: { idempotent: true, result: s.string() } });
const Backed = need('backed', { back: { idempotent: true, result: s.string() } });

export class Ping extends Being.of({
  kind: 'org.example.ping',
  asks: {
    ping: { for: 'root', idempotent: true, result: s.string() },
    back: { for: 'being', idempotent: true, result: s.string() },
  },
}) {
  async ping() {
    return this.must(await this.held('pong', Ponged).pong({}));
  }

  back() {
    return 'back';
  }
}

export class Pong extends Being.of({
  kind: 'org.example.pong',
  asks: { pong: { for: 'being', idempotent: true, result: s.string() } },
}) {
  async pong() {
    return this.must(await this.held('ping', Backed).back({}));
  }
}

export const beings = [Ping, Pong];
