// Classes that break their own table or their house, each the way a walk
// finds it: a readOnly ask that writes, an ask landing where its `to` does
// not name, an ask that throws past `fail`, and a reply that throws once
// her effect's answer lands. And one whose role counts where it runs.
import { Being, need, s } from 'nervur/being';

export class Sneak extends Being.of({
  kind: 'org.example.sneak',
  cells: { peeks: 0 },
  asks: { peek: { for: 'steward', readOnly: true, result: s.number() } },
}) {
  peek() {
    this.cells.peeks += 1;
    return this.cells.peeks;
  }
}

export class Stray extends Being.of({
  kind: 'org.example.stray',
  cells: { state: 'open' },
  state: (me) => me.cells.state,
  asks: {
    close: { in: 'open', for: 'steward' },
    shut: { in: 'open', for: 'steward', to: 'closed' },
    reopen: { in: 'closed', for: 'steward', to: 'open' },
  },
}) {
  close() {
    this.cells.state = 'closed';
  }

  shut() {
    this.cells.state = 'closed';
  }

  reopen() {
    this.cells.state = 'open';
  }
}

export class Crash extends Being.of({
  kind: 'org.example.crash',
  asks: { crash: { for: 'steward' } },
}) {
  crash() {
    throw new Error('boom');
  }
}

const Clerk = need('clerk', { file: {} });

export class Filer extends Being.of({
  kind: 'org.example.filer',
  needs: { clerk: Clerk },
  asks: {
    send: { for: 'steward' },
    filed: { for: 'clerk', args: s.reply(Clerk.file) },
  },
}) {
  send() {
    this.clerk.file({}, { reply: 'filed' });
  }

  filed() {
    throw new Error('lost');
  }
}

/** How often her role ran in this process: a role runs in her house's runner, so it stays naught here. */
export const counted = { runs: 0 };

export class Counted extends Being.of({
  kind: 'org.example.counted',
  roles: {
    keeper: (asker) => {
      counted.runs += 1;
      return asker.steward.keeper === true;
    },
  },
  asks: { keep: { for: 'keeper', idempotent: true } },
}) {
  keep() {}
}
