// A hosting house, whose entry grants it the `ground`: its steward opens a
// tenant house for each customer, lists and removes them, and invites a
// keeper of hers onto a tenant's steward. The keeper takes the invitation
// and asks the tenant's steward through it.
import { Being, GroundHouses, need, s, type Args, type Json } from 'nervur/being';

/** Any JSON value: a schema with no keyword. */
const ANY = Object.freeze({});

/** What a keeper asks a tenant's steward. */
export const Tenancy = need('org.example.tenancy', {
  whoami: { result: s.string(), readOnly: true },
});

export class Hosting extends Being.of({
  kind: 'org.example.hosting',
  needs: { ground: GroundHouses },
  roles: { pilot: (asker) => asker.id === 'root' },
  asks: {
    bear: { for: 'pilot', args: s.object({ id: s.string() }) },
    open: { for: 'pilot', idempotent: true, args: s.object({ name: s.string(), faculties: s.optional(s.array(s.string())) }), result: ANY },
    tenants: { for: 'pilot', idempotent: true, result: s.array(s.string()) },
    admit: { for: 'pilot', idempotent: true, args: s.object({ name: s.string(), id: s.string(), keeper: s.string() }), result: s.string() },
    // One ask of the ground named whole, answered as it came, so a test reads each refusal.
    raw: { for: 'pilot', idempotent: true, args: s.object({ method: s.string(), args: ANY }), result: ANY },
  },
}) {
  bear({ id }: Args<Hosting, 'bear'>) {
    this.powers!.bear({ kind: 'org.example.keeper', id });
  }

  async open({ name, faculties }: Args<Hosting, 'open'>) {
    // An entry's body is any object, which the need's schema leaves untyped.
    const classes = { faculty: 'module', name: 'tenant' } as never;
    return this.must(await this.ground.housesAdd({ name, classes, ...(faculties === undefined ? {} : { faculties }) })) as Json;
  }

  async tenants() {
    const houses = this.must(await this.ground.housesList({}));
    return houses.map(({ name }) => name);
  }

  // The invitation carried unopened to her keeper, who takes it.
  async admit({ name, id, keeper }: Args<Hosting, 'admit'>) {
    const { invitation } = this.must(await this.ground.housesInvite({ name, id }));
    const taken = await this.powers!.ask({ id: keeper, method: 'take', args: { invitation } });
    if (taken === undefined || taken.error) this.fail(taken?.error?.message ?? 'the take was no awaited call');
    return String(taken.result);
  }

  async raw({ method, args }: Args<Hosting, 'raw'>) {
    const face = this.ground as unknown as Record<string, (args: unknown) => Promise<{ result?: unknown; error?: { message: string } }>>;
    const answered = await face[method](args);
    return (answered.error === undefined ? { result: answered.result ?? null } : { error: answered.error.message }) as Json;
  }
}

export class Keeper extends Being.of({
  kind: 'org.example.keeper',
  cells: { tenant: '' },
  asks: {
    take: { args: s.object({ invitation: s.handle() }), result: s.string(), idempotent: true },
    whoami: { idempotent: true, result: s.string() },
  },
}) {
  take({ invitation }: Args<Keeper, 'take'>) {
    this.cells.tenant = invitation;
    return invitation;
  }

  async whoami() {
    const { result, error } = await this.held(this.cells.tenant, Tenancy).whoami({});
    if (error) this.fail(error.message);
    return result;
  }
}

export const steward = Hosting;
export const beings = [Keeper];
