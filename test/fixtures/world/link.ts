// A link of a chain: she passes an ask to the next link, and the last one
// waits on a faculty that never answers, for as long as her time allows.
// What she did is kept in her cells, so a test reads when she gave up.
import { Being, need, s, type Args } from 'nervur/being';

/** A faculty that never answers, and names a minute. */
export const Endless = need('endless', { hang: { hints: { readOnly: true }, wait: 60_000 } });

/** The faculty: its one method never answers. */
export const endless = { hang: () => new Promise(() => undefined) };

/** What a link asks the next. */
const Next = need('next', { pass: { hints: { idempotent: true }, wait: 60_000, result: s.string() } });

export class Link extends Being.of({
  kind: 'org.example.link',
  needs: { endless: Endless },
  cells: { next: '', outcome: '' },
  asks: {
    accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    pass: { hints: { idempotent: true }, wait: 60_000, result: s.string() },
    // Not readOnly, so it holds her queue while it hangs.
    block: { hints: { idempotent: true }, wait: 60_000 },
    outcome: { hints: { readOnly: true }, result: s.string() },
  },
}) {
  accept({ invitation }: Args<Link, 'accept'>) {
    this.cells.next = invitation;
  }

  async pass() {
    if (this.cells.next !== '') return this.held(this.cells.next, Next).pass({});
    this.cells.outcome = 'ran';
    try {
      await this.endless.hang({});
      return 'answered';
    } catch {
      this.cells.outcome = `gave up at ${this.house.now()}`;
      return 'gave up';
    }
  }

  async block() {
    await this.endless.hang({}).catch(() => undefined);
  }

  outcome() {
    return this.cells.outcome;
  }
}
