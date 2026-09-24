import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList } from '../../../src/bodies/class-list.ts';
import { Counter } from '../../fixtures/world/counter.ts';
import { Steward } from '../../fixtures/world/steward.ts';
import { Lobby } from '../fixtures/lobby.ts';
import { classesSuite } from '../../suites/classes.ts';

classesSuite(
  'ClassList',
  ({ steward, public: open, other }) => new ClassList({ steward, public: open, beings: [other] }),
  { steward: Steward, public: Lobby, other: Counter },
  { steward: 'org.example.steward', public: 'org.example.lobby', other: 'org.example.counter' },
);

test('A kind is bound to its source: two classes claiming one kind are refused', async () => {
  const { Counter: Twin } = await import('../fixtures/twin.ts');
  assert.throws(() => new ClassList({ steward: Steward, beings: [Counter, Twin] }), /two classes claim the kind org.example.counter/);
});
