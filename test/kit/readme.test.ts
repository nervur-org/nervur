// SPDX-License-Identifier: Apache-2.0
// The README's world, as it is written there, through the main entry alone:
// its greetings.js is read out of the README and added as its source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULTS, World, type JsonObject } from '../../src/index.ts';
import { holds } from '../claims.ts';
import { add, being, root } from '../core/harbor/asks.ts';

const README = new URL('../../README.md', import.meta.url);

const VISITS = `import { Being } from 'nervur';
export const module = 'org.example.visits';
export const version = '1.0.0';
class Visitor extends Being {
  static kind = 'org.example.visitor';
  static asks = { visit: {} };
  async visit(args) {
    await this.stance.standings.take('greeter', args.invitation);
    return this.stance.standings.get('greeter')?.ask('hello');
  }
}
export const classes = [Visitor];
`;

test(holds('proof.readme', 'readme: the world in the README stands, and a second harbor visits it'), async () => {
  const text = await readFile(README, 'utf8');
  const greetings = /```js\n\/\/ greetings\.js\n([\s\S]*?)```/.exec(text)?.[1];
  assert.ok(greetings, 'the README writes greetings.js');
  const world = new World(DEFAULTS);
  const harbor = await world.harbor('home');
  assert.equal(((await add(harbor, greetings)) as JsonObject).added, 'org.example.greetings');
  await root(harbor, 'open', { key: 'clock', class: 'org.example.system-time' });
  await root(harbor, 'host', { ward: 'alice' });
  await root(harbor, 'boot', { key: 'greeter', class: 'org.example.greeter' }, 'alice');

  const away = await world.harbor('away');
  assert.equal(((await add(away, VISITS)) as JsonObject).added, 'org.example.visits');
  await root(away, 'host', { ward: 'bob' });
  await root(away, 'boot', { key: 'visitor', class: 'org.example.visitor' }, 'bob');
  const invitation = await root(harbor, 'invite', { being: 'greeter', id: 'bob' }, 'alice');
  const out = (await being(away, 'visitor', 'visit', { invitation }, 'bob')) as { hello: string; time: { now: number } };
  assert.equal(out.hello, 'bob');
  assert.equal(typeof out.time.now, 'number');

  await world.restart('home');
  const again = (await being(away, 'visitor', 'visit', { invitation }, 'bob')) as { hello: string };
  assert.equal(again.hello, 'bob');
});
