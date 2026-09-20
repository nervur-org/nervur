// SPDX-License-Identifier: Apache-2.0
// The grounds as the entries add them: the Node entry knows the Node
// ground and the neutral one, `Harbor.open()` with no terrain stands a
// harbor of the Node ground on the defaults, and the neutral ground opens
// the web and push where it is asked and speaks no TCP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS, grounds, Harbor, NEUTRAL, type JsonObject } from '../../src/node.ts';
import { probeGround } from '../../src/core/harbor/index.ts';
import { neutralGround } from '../../src/core/line/index.ts';
import { holds } from '../claims.ts';
import { scratch } from '../core/contract/suites.ts';

const root = async (harbor: Harbor, method?: string, args?: JsonObject): Promise<unknown> => {
  const out = await harbor.ask({ ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }) });
  return 'answer' in out ? out.answer : out;
};

test(holds('ground.probed', 'probe: the Node entry tries the Node ground and then the neutral one, and a harbor opened with no terrain stands on the Node ground and the defaults'), async () => {
  assert.deepEqual(grounds(), ['node', NEUTRAL]);
  const dir = scratch();
  const harbor = await Harbor.open({ where: dir });
  assert.ok(existsSync(join(dir, 'seed')), 'kept in the folder named');
  assert.equal(((await root(harbor)) as { notes: { class: string } }).notes.class, DEFAULTS.dock.kind);
  await harbor.close();

  const bare = await Harbor.open(probeGround({}, [{ probe: neutralGround, defaults: DEFAULTS }]).terrain);
  assert.deepEqual(await root(bare, 'open', { key: 'web', class: 'org.nervur.web' }), { opened: 'web' });
  assert.deepEqual(await root(bare, 'open', { key: 'tcp', class: 'org.nervur.tcp' }), { error: 'not opened' }, 'a ground that has no sockets opens no TCP');
  await bare.close();
});
