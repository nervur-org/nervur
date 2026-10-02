// An owner's dock classes: a steward that adds asks to the library's and
// bears beings of her own kind, and a site whose entry's kinds are granted
// a `website` body of the ladder. Her `reach` tries what the seal refuses.
import { dockSteward } from 'nervur';
import { Being, need, s, type Args } from 'nervur/being';

export const Website = need('org.example.website', {
  publish: { args: s.object({ page: s.string() }), result: s.object({ at: s.string() }), idempotent: true },
});

export class SiteSteward extends dockSteward({
  cells: { sites: 0 },
  asks: {
    sitesAdd: { for: 'root', args: s.object({ id: s.string() }), idempotent: true, examples: [{ args: { id: 'site' }, gives: { result: null } }] },
    sitesCount: { for: 'root', result: s.integer(), readOnly: true, examples: [{ description: 'one site borne', given: [{ ask: 'sitesAdd', args: { id: 'site' } }], gives: { result: 1 } }] },
    reach: { for: 'root', args: s.object({ what: s.string(), id: s.optional(s.string()) }), result: s.object({}), idempotent: true },
  },
}) {
  sitesAdd({ id }: Args<SiteSteward, 'sitesAdd'>) {
    this.powers!.bear({ kind: 'org.example.site', id });
    this.cells.sites += 1;
  }

  sitesCount() {
    return this.cells.sites;
  }

  // Each road the seal closes: a library being asked, a library kind borne, the ground's work, and an ask that is root's alone.
  async reach({ what, id = '' }: Args<SiteSteward, 'reach'>) {
    const self = this as unknown as Record<string, (args?: unknown) => unknown>;
    if (what === 'ask') this.must(await this.powers!.ask({ id, method: 'kept' }));
    if (what === 'bear') this.powers!.bear({ kind: 'org.nervur.dock.secret', id });
    if (what === 'ground') (this as unknown as { ground: unknown }).ground;
    if (what === 'secrets') await self.secretsList();
    return {};
  }
}

export class Site extends Being.of({
  kind: 'org.example.site',
  needs: { website: Website },
  cells: { at: null as string | null },
  asks: { publish: { for: 'root', args: s.object({ page: s.string() }), result: s.object({ at: s.string() }), idempotent: true } },
}) {
  async publish({ page }: Args<Site, 'publish'>) {
    const { at } = this.must(await this.website.publish({ page }));
    this.cells.at = at;
    return { at };
  }
}
