// A person's being is her one door in the house. From it she zooms to
// another being: her steward mints the door, she carries the invitation
// unopened, and where her answer goes decides its form. To the face that
// holds her door it is a token, and carried home it stays an invitation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Front, FrontBlueprint } from '../fixtures/world/front.ts';
import * as zoom from '../fixtures/zoom/zoom.ts';

const open = async (t: { after(done: () => unknown): void }) => {
  const front = new Front();
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'zoom', modules: { zoom }, faculties: { front: { blueprint: FrontBlueprint, object: front } } });
  t.after(() => ground.down());
  const standing = await ground.add('zoom', 'zoom', { faculties: ['front'] });
  assert.ok(standing.ward !== undefined, standing.why ?? 'the house did not open');
  const armed = await ground.ask({ house: 'zoom', method: 'arm' });
  assert.ok('result' in armed, JSON.stringify(armed));
  return { front, door: await front.signup('ada') };
};

test('A person’s being hands her face a door the steward minted on another being, and the face calls it', async (t) => {
  const { front, door } = await open(t);
  const zoomed = await front.ask(door, 'zoom', { target: 'shop' });
  assert.ok('result' in zoomed, JSON.stringify(zoomed));
  const token = (zoomed.result as { door: string }).door;
  assert.match(token, /^[0-9a-f]{32}$/, 'the face holds a token, never invitation bytes');
  assert.deepEqual(await front.ask(token, 'hello'), { result: 'hello, zoom-being:person-ada' }, 'the face calls the shop as the occupant the steward minted');
  const shown = await front.describe(token);
  assert.match(JSON.stringify(shown), /"hello"/, 'and reads what that occupant may ask');
});

test('The same zoom carried home leaves as an invitation, for a house to take', async (t) => {
  const { front, door } = await open(t);
  const carried = await front.carryHome(door, 'zoom');
  assert.ok('result' in carried, JSON.stringify(carried));
  const bytes = (carried.result as { door: string }).door;
  assert.ok(bytes.length > 1000, 'invitation bytes, which a house takes');
  assert.ok('error' in (await front.ask(bytes, 'hello')), 'bytes are no token a face can call');
});
