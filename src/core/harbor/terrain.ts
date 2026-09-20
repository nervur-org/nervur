// SPDX-License-Identifier: Apache-2.0
// Where a harbor runs. A terrain hands the harbor one body for each
// contract the onion cannot unpack from cells, and the carriers its
// ground speaks.
import type { BeingClass } from '../being/index.ts';
import type { Carrier, Clock, Custody, Entropy, Loader, Memory } from '../contract/index.ts';
import type { Sockets, WebServe } from './carrying.ts';
import type { Harbor } from './harbor.ts';

// The beings and faculties a harbor runs where its owner writes none, which
// the core never names: the dock the box ward takes at genesis and whenever
// her own does not stand, the ward a hosted ward takes where none is named,
// and every other default class, the carriers among them. An entry hands
// them in, and the core resolves each by its kind.
export type Defaults = { readonly dock: BeingClass; readonly ward: BeingClass; readonly classes: readonly BeingClass[] };

export abstract class Terrain {
  abstract readonly entropy: Entropy;
  abstract readonly clock: Clock;
  abstract readonly custody: Custody;
  abstract readonly memory: Memory;
  // The code the catalogue's cells name.
  abstract readonly loader: Loader;
  // What reaches a ward pk this harbor holds no route for.
  abstract readonly carrier: Carrier;
  abstract readonly defaults: Defaults;
  // The platform under the carriers, where this ground has one: the sockets
  // TCP is spoken on, one set for each carrier that asks, and the listener
  // the web carrier runs.
  readonly tcp: (() => Sockets) | undefined = undefined;
  readonly web: WebServe | undefined = undefined;
  // Whether its carriers wake and listen where their cells say. A harbor
  // opened for one ask and closed again dials and hears nothing.
  readonly wakes: boolean = true;
  // Whether the harbor lives only as long as a screen: a tab's, or a worker
  // one tab owns. It is reached only while that screen is open, and hears
  // no push, so its census says so.
  get foreground(): boolean {
    return false;
  }

  // Before the harbor opens: a terrain whose ground another run holds
  // refuses here. Once it stands: whatever the ground serves beside it.
  // Once its carriers sleep: what that served, gone.
  claim(): Promise<void> {
    return Promise.resolve();
  }
  stand(_harbor: Harbor): Promise<void> {
    return Promise.resolve();
  }
  release(): Promise<void> {
    return Promise.resolve();
  }
}
