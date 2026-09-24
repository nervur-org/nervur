// SPDX-License-Identifier: Apache-2.0
// An edge's memory: Durable Object storage, one memory for each name. The
// object runs one event at a time and a write is one transaction, so a
// write whose places moved lands nothing.
import { KeptMemory } from '../bodies/kept.ts';
import { durableStore, type DurableStorage } from './durable.ts';

export class DurableMemory extends KeptMemory {
  constructor(storage: DurableStorage, name: string) {
    super(durableStore(storage), name);
  }
}
