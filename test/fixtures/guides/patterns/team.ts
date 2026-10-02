// patterns/team.ts
import { Being, need, s, type Args } from 'nervur/being';

const Work = need('work', {
  work: { idempotent: true, args: s.object({ job: s.string() }), result: s.string() },
});

const Report = need('report', {
  done: { args: s.object({ job: s.string() }) },
});

export class Manager extends Being.of({
  kind: 'org.example.manager',
  cells: { done: [] as string[] },
  asks: {
    assign: { for: 'root', idempotent: true, args: s.object({ job: s.string() }), result: s.string() },
    done: { for: 'being', args: s.object({ job: s.string() }) },
    report: { for: 'root', readOnly: true, result: s.array(s.string()) },
  },
}) {
  async assign({ job }: Args<Manager, 'assign'>) {
    return this.must(await this.held('clerk', Work).work({ job }));
  }

  done({ job }: Args<Manager, 'done'>) {
    if (!this.cells.done.includes(job)) this.cells.done = [...this.cells.done, job];
  }

  report() {
    return this.cells.done;
  }
}

export class Clerk extends Being.of({
  kind: 'org.example.clerk',
  asks: {
    work: { for: 'being', idempotent: true, args: s.object({ job: s.string() }), result: s.string() },
  },
}) {
  work({ job }: Args<Clerk, 'work'>) {
    // The manager awaits this ask, so she answers back with an effect.
    this.held('manager', Report).done({ job });
    return `on it: ${job}`;
  }
}

export const beings = [Manager, Clerk];
