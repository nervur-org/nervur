// SPDX-License-Identifier: Apache-2.0
// A carrier is a faculty. It speaks the schemes of the addresses it dials,
// dials an address when the harbor carries a box there, and listens where
// its cells say, handing each box it hears to the harbor. The harbor keeps
// every route and walks it in order, handing each address to the carrier
// that speaks its scheme.
//
// A ground ships its carriers as plain classes the terrain names, each of
// a fixed kind and born of its stance alone. They are the kit's, of kinds
// under `org.nervur.`, and the dock opens them as faculties on the root's
// `open` alone.
import { Faculty, ships, type BeingClass, type Stance } from '../being/index.ts';
import type { RootRequest } from './root-line.ts';
import type { Terrain } from './terrain.ts';

// What a listener hands a box it heard to.
export interface Arrivals {
  arrive(pk: string, bytes: Uint8Array): Promise<Uint8Array | null>;
}

// What the box ward's stance carries as `ground` for the faculties born of
// it: the harbor, its doors and the terrain it stands on.
export interface Ground extends Arrivals {
  readonly terrain: Terrain;
}

// The ground a faculty of the box ward is born on.
export const groundOf = (stance: Stance): Ground => {
  const { ground } = stance as Stance & { ground?: Ground };
  if (!ground) throw new Error('a kit faculty stands in the box ward alone');
  return ground;
};

// Beside a reply and nothing, a dial answers `undialed` when the address
// could not be reached at all, so the harbor tries the next one. A box a
// line took may have been heard, so after it no other address is tried.
export const UNDIALED = Symbol('undialed');
export type Dialed = Uint8Array | null | typeof UNDIALED;

// The bodies a ground hands its carriers, where it has them. A carrier
// faculty is one class on every ground; what differs between grounds is the
// platform under it, and that is a body of the terrain.

// Where the web carrier listens, as its cells keep it: a host, the port it
// bound, the path it answers on, and the origins whose pages it answers.
export type WebListen = { host: string; port: number; path: string; origins: string[] };

// A listener a ground runs for the web carrier: it hands every ask it
// hears to the harbor, and says the addresses it answers at, a post's and
// a held line's.
export interface WebListener {
  readonly at: string[];
  readonly port: number;
  close(): Promise<void>;
}
export type WebServe = (ground: Arrivals, listen: WebListen) => Promise<WebListener>;

// Quo over TCP on a ground's sockets: it dials `tcp://` addresses, keeping
// one line per address, and listens where it is told, or refuses to.
export interface TcpListening {
  readonly at: string;
  close(): Promise<void>;
}
export interface Sockets {
  dial(address: string, pk: string, bytes: Uint8Array): Promise<Dialed>;
  listen(ground: Arrivals, host: string, port: number): Promise<TcpListening>;
  // Every line it dialed, closed.
  close(): Promise<void>;
}

export abstract class CarrierFaculty extends Faculty {
  static override readonly kind: string = 'org.nervur.carrier';
  static {
    ships(this);
  }
  // The carrier of Quo it speaks, as `quo/` names one by the scheme of its
  // addresses, `tcp` or `web`, or null for one it does not name. A front
  // finds the carrier it opens by this, and opens it under this name.
  static readonly carries: string | null = null;

  // Whether this carrier dials an address, written as its carrier writes it.
  abstract accepts(address: string): boolean;
  abstract dial(address: string, pk: string, bytes: Uint8Array): Promise<Dialed>;

  // The addresses it listens at now.
  listening(): string[] {
    return [];
  }

  // Its answer to a box for a ward pk no door of this harbor holds, where
  // it answers for that pk, as a relay does, and null where it does not.
  relay(_pk: string, _bytes: Uint8Array): Promise<Uint8Array | null> | null {
    return null;
  }

  // A push the device heard, which says only that something waits: a
  // carrier that collects for this harbor collects now.
  heard(): Promise<void> {
    return Promise.resolve();
  }

  // Once the harbor has unpacked, and once before it closes.
  awake(): Promise<void> {
    return Promise.resolve();
  }
  sleep(): Promise<void> {
    return Promise.resolve();
  }
}

// What a front asks so a carrier of Quo stands in the box ward, read from
// the box's census and the classes its entry hands it: the key of a being
// whose class carries it, or else an `open` under the carrier's name of the
// class that carries it, or null where no class does.
export const carrierIn = (beings: Readonly<Record<string, { class: string }>>, classes: readonly BeingClass[], carries: string): { key: string; open?: RootRequest } | null => {
  const carrying = classes.filter((C) => C.prototype instanceof CarrierFaculty && (C as unknown as typeof CarrierFaculty).carries === carries);
  const standing = Object.entries(beings).find(([, being]) => carrying.some((C) => C.kind === being.class));
  if (standing) return { key: standing[0] };
  const C = carrying[0];
  return C ? { key: carries, open: { method: 'open', args: { key: carries, class: C.kind } } } : null;
};
