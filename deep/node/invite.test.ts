// Alice on a ground of its own process: her owner there lands Bob's paper,
// and her asks reach Bob over TCP. In Bob's house, beside it, and on a
// ground in the test's process, it is `test/node/invite.test.ts`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groundOne, groundTwo } from '../../test/fixtures/node/grounds.ts';
import { beforehand, bobIn, landIn, placed } from '../../test/fixtures/node/invite.ts';

for (const alice of ['known', 'newborn'] as const) {
  test(`Alice on a ground of her own process, ${alice}: her owner there lands the paper, and her asks reach Bob over TCP`, async (t) => {
    const ground = await groundOne(t);
    const bobs = await ground.open('a');
    const mint = await bobIn(bobs);
    const { ask: hers } = await groundTwo(t);
    await beforehand(hers, alice);
    await landIn(hers, await mint('for-alice'), alice);
    await placed(bobs.ask, hers, 'for-alice');
    assert.ok(ground.heard.tcp > 0, 'Bob’s TCP listener took her asks');
    assert.equal(ground.heard.http, 0, 'TCP comes first in his paper, and answered');
  });
}
