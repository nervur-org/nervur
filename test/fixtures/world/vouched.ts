// A shop's site, which serves the domain's vouch on its ground's listener,
// and a holder at home, who takes a shop's paper and reads which domains
// vouch for the ward behind it.
import { Being, need, s, type Args } from 'nervur/being';
import { Steward } from './steward.ts';

/** The site's faculty offers nothing to beings: it is a handler alone. */
export const SiteBlueprint = need('site', {});

/** The file at `/.well-known/quo`, listing the wards the test names. */
export class Site {
  wards: string[] = [];

  readonly handler = {
    fetch: (request: Request): Promise<Response | null> =>
      Promise.resolve(new URL(request.url).pathname === '/.well-known/quo' ? Response.json({ wards: this.wards }) : null),
  };
}

export class Holder extends Being.of({
  kind: 'org.example.holder',
  cells: { shop: '' },
  asks: {
    take: { for: 'root', hints: { idempotent: true }, args: s.object({ paper: s.handle() }) },
    // What she shows the person: the domains that vouch for each far standing.
    vouched: { for: 'root', hints: { readOnly: true }, result: s.array(s.array(s.string())) },
    // One ask of the shop, so a ward that moved tells her where it is now.
    look: { for: 'root', hints: { idempotent: true }, result: s.array(s.string()) },
  },
}) {
  take({ paper }: Args<Holder, 'take'>) {
    this.cells.shop = paper;
  }

  vouched() {
    return this.standings
      .list()
      .filter(({ id }) => id !== 'steward')
      .map(({ vouched }) => [...vouched]);
  }

  async look() {
    const { asks } = await this.held(this.cells.shop).describe();
    return asks.map(({ method }) => method);
  }
}

export const home = { steward: Steward, beings: [Holder] };
