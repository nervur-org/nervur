// SPDX-License-Identifier: Apache-2.0
// The two stewards the bench stands on: one keeps the author's house where
// the test brings no steward of its own, the other adopts a handle to each
// being the bench places, in the bench's own house.
import { Being, s, type Args } from '../being/index.ts';

export class BenchSteward extends Being.of({
  kind: 'org.nervur.bench.steward',
  asks: {},
}) {}

export class BenchTester extends Being.of({
  kind: 'org.nervur.bench.tester',
  asks: {
    adopt: { for: 'root', args: s.object({ invitation: s.handle() }), result: s.string() },
  },
}) {
  adopt({ invitation }: Args<BenchTester, 'adopt'>) {
    return invitation;
  }
}
