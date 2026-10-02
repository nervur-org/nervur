// patterns/search.ts
import { Being, need, s, type Args } from 'nervur/being';

const Index = need('index', {
  put: { idempotent: true, args: s.object({ price: s.number() }) },
});

export class Listing extends Being.of({
  kind: 'org.example.listing',
  cells: { price: 0 },
  asks: {
    price: { for: 'root', args: s.object({ price: s.number() }) },
  },
}) {
  async price({ price }: Args<Listing, 'price'>) {
    this.must(await this.held('search', Index).put({ price }));
    this.cells.price = price;
  }
}

// The index answers the question no listing can: which are cheapest.
export class Search extends Being.of({
  kind: 'org.example.search',
  cells: { prices: {} },
  asks: {
    put: { for: 'being', idempotent: true, args: s.object({ price: s.number() }) },
    cheapest: { for: 'root', readOnly: true, result: s.array(s.string()) },
  },
}) {
  // Keyed by the true asker, so no listing writes another's price.
  put({ price }: Args<Search, 'put'>) {
    this.cells.prices = { ...this.cells.prices, [this.asker.id]: price };
  }

  cheapest() {
    const sorted = Object.entries<number>(this.cells.prices).sort(([, a], [, b]) => a - b);
    return sorted.slice(0, 3).map(([id]) => id);
  }
}

export const beings = [Listing, Search];
