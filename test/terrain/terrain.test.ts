// SPDX-License-Identifier: Apache-2.0
// The main entry runs wherever JavaScript runs: the same exercise, bundled
// for a neutral platform, reports the same scenes all green in Node, Deno,
// Bun, workerd and Chromium, its web scenes against a harbor this Node
// process stands. Chromium runs it as
// a browser bundle, and adds the browser ground's scenes: its IndexedDB
// bodies under the contract and law scenes, and a harbor with no terrain.
// An engine this machine lacks skips and names what to install.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { main } from '../../src/core/cli/command.ts';
import { webServe } from '../../src/core/http/index.ts';
import { DEFAULTS, Harbor, PointerTerrain, type JsonObject } from '../../src/index.ts';
import { LAW, law } from '../../src/core/proof/index.ts';
import { holds } from '../claims.ts';
import { scratch } from '../core/contract/suites.ts';
import { bundle, DEADLINE, has, inBun, inChromium, inDeno, inNode, inWorkerd, SECRET, type AroundWorker, type Bundle, type Restart } from './engines.ts';

// One command, run in this process, and the JSON line it printed. The
// environment holds the worker's secret, as its owner's shell holds it
// for `edge pack`.
const command = async (argv: string[]): Promise<{ code: number; out: JsonObject }> => {
  const lines: string[] = [];
  const code = await main(argv, { NERVUR_SECRET: SECRET }, (line) => lines.push(line), DEFAULTS);
  return { code, out: JSON.parse(lines.at(-1) ?? '{}') as JsonObject };
};
import { run, type Result } from './exercise.ts';
import { stand } from './host.ts';
import { add, being, census, root } from '../core/harbor/asks.ts';

let built: Bundle;
let page: Bundle;
let edge: Bundle;
let host: Awaited<ReturnType<typeof stand>>;
let reference: Result[];
before(async () => {
  [built, page, edge] = await Promise.all([bundle(), bundle('browser'), bundle('edge')]);
  host = await stand();
});
after(async () => {
  await built.dispose();
  await page.dispose();
  await edge.dispose();
  await host.close();
});

const green = (results: Result[], where: string, extra = ''): void => {
  const failed = results.filter((r) => r.error);
  assert.deepEqual(failed, [], `${where} failed scenes`);
  assert.deepEqual(
    results.map((r) => r.name).filter((name) => !extra || !name.startsWith(extra)),
    reference.map((r) => r.name),
    `${where} ran other scenes than Node did`,
  );
};

// Each scene runs the whole exercise in an engine, a few seconds of Ed25519
// and X25519 in JavaScript, and several seconds more under `cover`'s
// instrumentation, so it has the time an engine is given to run it.
const TIME = { timeout: DEADLINE };

// The reference every other engine is held to, run here and not in the
// hook, so its time is this scene's own.
test('[terrain] Node runs the exercise from source', TIME, async () => {
  reference = await run(await host.reach());
  assert.ok(reference.some((r) => r.name.startsWith('web:')));
  green(reference, 'node');
});

test('[terrain] Node runs the bundle', TIME, async () => green(await inNode(built, await host.reach()), 'node, bundled'));

test('[terrain] Deno runs the bundle', { ...TIME, skip: has('deno') ? false : 'no deno: npm i -D deno' }, async () => green(await inDeno(built, await host.reach()), 'deno'));

test('[terrain] Bun runs the bundle', { ...TIME, skip: has('bun') ? false : 'no bun: npm i -D bun' }, async () => green(await inBun(built, await host.reach()), 'bun'));

// The shop of a carried harbor, in its child, asked from Node by post and
// on a held line through the shell, and again after workerd restarts from
// its disk.
const SHOPPED = 'edge: a shop carried to the edge answers Node by post and on a held line through the shell, again after workerd restarts, and a name the pack does not hold is 404';
const shopScene = async (base: string, restart: Restart, invitation: JsonObject): Promise<Result[]> => {
  const caller = await Harbor.open(new PointerTerrain({ defaults: DEFAULTS, web: webServe }));
  try {
    const held = `${base.replace(/^http/, 'ws')}/main/quo`;
    await add(caller, LAW);
    await root(caller, 'open', { key: 'web', class: 'org.nervur.web' });
    await root(caller, 'host', { ward: 'alice' });
    await root(caller, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
    const me = (method: string, args: JsonObject = {}) => being(caller, 'me', method, args, 'alice');
    assert.deepEqual(await me('join', { invitation }), { joined: 'shop' }, 'by a post to the object');
    assert.deepEqual(await me('buy', { item: 'tea' }), { said: { bought: 'tea' } });
    const shop = invitation.ward as string;
    const post = (await census(caller)).routes![shop]!;
    assert.deepEqual(await root(caller, 'route', { ward: shop, at: [held] }), { routed: shop });
    assert.deepEqual(await me('buy', { item: 'cake' }), { said: { bought: 'cake' } }, 'on a held line to the object');
    await restart();
    assert.deepEqual(await root(caller, 'route', { ward: shop, at: post }), { routed: shop });
    assert.deepEqual(await me('buy', { item: 'pie' }), { said: { bought: 'pie' } }, 'the object stood again from its disk, under its secret');
    const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
    assert.ok(readme.includes('export const Harbor = harborShell({ kit, pack });\nexport default harborWorker();'), 'the README declares the worker as this one is');
    for (const path of ['/stranger/quo', '/Bad/quo', '/readme/quo']) assert.equal((await fetch(`${base}${path}`, { method: 'POST' })).status, 404, `${path}: no harbor is packed or born under it`);
    return [{ name: SHOPPED }];
  } catch (e) {
    return [{ name: SHOPPED, error: String((e as Error).stack ?? e) }];
  } finally {
    await caller.close();
  }
};

// Two harbors born in folders, set up as their owner would, packed with
// the command into one pack under the worker's one secret, and carried to
// the edge: one worker class holds both, each an object by its name at its
// own path. The command pilots each from another folder over the web, as
// it pilots a droplet, and again after workerd restarts.
const CARRIED = 'edge: two harbors born on Node and packed under one secret are carried to one worker, each by its name, and the command pilots both over the web';
const CARRIED_AGAIN = 'edge: the carried harbors are piloted again after workerd restarts, and their pack does not land twice';
const NAMES = ['main', 'yard'] as const;

// A module in two versions, and one that throws as it loads.
const greetings = (version: string): string => `import { Faculty } from 'nervur';
export const module = 'org.example.greetings';
export const version = '${version}';
class Greeter extends Faculty {
  static kind = 'org.example.greeter';
  static asks = { hello: {} };
  hello() {
    return { hello: '${version}' };
  }
}
export const classes = [Greeter];
`;
const BROKEN = `throw new Error('broken as it loads');
export const module = 'org.example.broken';
export const version = '1.0.0';
export const classes = [];
`;

// `live` moved on the shell by the command, with no deploy: a module
// added, a new version of it, a rollback, a module refused, and the other
// harbor of the worker untouched. Again after workerd restarts: the
// commit `live` names stands.
const SHELLED = 'edge: live moves on the shell with no deploy, a module added answers, a rollback stands the commit before, a module that does not load is refused, and the other harbor stays';
const SHELLED_AGAIN = 'edge: after workerd restarts, the shell stands the commit live names';
// Asks at once on relations of their own: one adds a module the child
// does not carry, and the others land in the child its miss spends. Each
// is answered, whichever order the child ran them in.
const CONCURRENT = 'edge: asks at once, one missing a module the child does not carry, are each answered, the others asked again in the next child';
const ALONGSIDE = 6;

const carriedEdge = (): AroundWorker => {
  const mine = scratch();
  const owners: Record<string, JsonObject> = {};
  let alongside: JsonObject = {};
  const pks: Record<string, string> = {};
  let shopInvitation: JsonObject = {};
  let rolled = '';
  const via = async (name: string, ...argv: string[]): Promise<JsonObject> => (await command([...argv, '--via', name, '--dir', mine])).out;
  const catalogue = async (name: string, method: string, args: JsonObject = {}): Promise<JsonObject> => ((await via(name, 'ask', 'catalogue', method, JSON.stringify(args))) as { answer: { answer: JsonObject } }).answer.answer;
  const hello = async (): Promise<unknown> => ((await via('main', 'ask', 'g', 'hello')) as { answer: { answer: unknown } }).answer.answer;
  const shelled = async (scene: string): Promise<Result[]> => {
    try {
      if (scene === SHELLED) {
        const first = await catalogue('main', 'add', { source: greetings('1.0.0') });
        assert.equal(first.added, 'org.example.greetings', JSON.stringify(first));
        rolled = first.live as string;
        assert.deepEqual(await via('main', 'open', 'g', 'org.example.greeter'), { answer: { opened: 'g' } });
        assert.deepEqual(await hello(), { hello: '1.0.0' }, 'a module added, with no pack and no deploy, answers in the next child');
        const second = await catalogue('main', 'add', { source: greetings('1.0.1') });
        assert.equal(second.version, '1.0.1', JSON.stringify(second));
        assert.deepEqual(await hello(), { hello: '1.0.1' }, 'its being born again of the new version');
        assert.deepEqual(await catalogue('main', 'live', { commit: rolled }), { live: rolled });
        assert.deepEqual(await hello(), { hello: '1.0.0' }, 'live moved back stands the commit before');
        const broken = (await catalogue('main', 'add', { source: BROKEN })).error as string;
        assert.match(broken, /^the module does not load on the edge: [\s\S]*broken as it loads/, 'a module that throws as it loads is refused');
        assert.equal((await catalogue('main', 'live')).live, rolled, 'and live stays');
        assert.deepEqual(await hello(), { hello: '1.0.0' });
        const yard = await catalogue('yard', 'modules');
        assert.notEqual(yard.live, rolled, 'the other harbor of the worker moved nowhere');
        assert.ok(!Object.hasOwn(yard.modules as JsonObject, 'org.example.greetings'), 'and runs none of it');
      } else {
        assert.equal((await catalogue('main', 'live')).live, rolled);
        assert.deepEqual(await hello(), { hello: '1.0.0' }, 'the commit live names stands across a restart');
        assert.equal(((await catalogue('main', 'modules')).modules as Record<string, JsonObject>)['org.example.greetings']!.running, '1.0.0');
      }
      return [{ name: scene }];
    } catch (e) {
      return [{ name: scene, error: String((e as Error).stack ?? e) }];
    }
  };
  const concurrent = async (): Promise<Result[]> => {
    const caller = await Harbor.open(new PointerTerrain({ defaults: DEFAULTS, web: webServe }));
    try {
      await root(caller, 'open', { key: 'web', class: 'org.nervur.web' });
      const names = Array.from({ length: ALONGSIDE }, (_, i) => `g${String(i)}`);
      for (const name of names) {
        const invited = await via('main', 'invite', 'g', name);
        assert.equal((await root(caller, 'hold', { name, invitation: invited.answer as JsonObject })).held, name, JSON.stringify(invited));
      }
      assert.equal((await root(caller, 'hold', { name: 'owner', invitation: alongside })).held, 'owner');
      // The greeters are asked over and over, each ask on its line after
      // the one before is answered, until the add is answered, so some land
      // while the child is spent, whichever order the child runs them in.
      let adding = true;
      const adds = root(caller, 'pilot', { name: 'owner', method: 'ask', args: { being: 'catalogue', method: 'add', args: { source: greetings('1.0.2') } } }).finally(() => (adding = false));
      const asking = names.map(async (name) => {
        const said: unknown[] = [];
        do said.push(await root(caller, 'pilot', { name, method: 'hello' }));
        while (adding);
        return said;
      });
      const added = ((await adds) as { answer: { answer: JsonObject } }).answer.answer;
      const hellos = (await Promise.all(asking)).flat();
      assert.equal(added.version, '1.0.2', `the ask that missed is answered: ${JSON.stringify(added)}`);
      for (const said of hellos) assert.ok(['1.0.0', '1.0.2'].some((v) => JSON.stringify(said) === JSON.stringify({ answer: { hello: v } })), `an ask beside it is answered: ${JSON.stringify(said)}`);
      assert.deepEqual(await hello(), { hello: '1.0.2' }, 'and live moved once');
      assert.deepEqual(await catalogue('main', 'live', { commit: rolled }), { live: rolled });
      return [{ name: CONCURRENT }];
    } catch (e) {
      return [{ name: CONCURRENT, error: String((e as Error).stack ?? e) }];
    } finally {
      await caller.close();
    }
  };
  const around = {
    prepare: async (base: string): Promise<Record<string, string>> => {
      // Every step the command's, as the README runs it.
      const file = join(scratch(), 'pack.edge.json');
      const module = join(scratch(), 'law.js');
      await writeFile(module, LAW);
      for (const name of NAMES) {
        const born = scratch();
        const at = ['--dir', born];
        pks[name] = (await command(['init', ...at])).out.pk as string;
        assert.equal((await command(['module', 'add', module, ...at])).code, 0);
        assert.equal((await command(['host', 'shop', ...at])).code, 0);
        assert.equal((await command(['boot', '--ward', 'shop', 'shop', 'org.example.shop', ...at])).code, 0);
        assert.equal((await command(['reach', `${base}/${name}/quo`, ...at])).code, 0);
        owners[name] = (await command(['own', 'pilot', ...at])).out.answer as JsonObject;
        if (name === 'main') alongside = (await command(['own', 'alongside', ...at])).out.answer as JsonObject;
        if (name === 'main') shopInvitation = (await command(['invite', 'shop', 'node', '--ward', 'shop', ...at])).out.answer as JsonObject;
        const packed = await command(['edge', 'pack', file, name, '--dir', born]);
        assert.equal(packed.code, 0, JSON.stringify(packed.out));
        assert.equal(packed.out.package, file);
        assert.deepEqual(packed.out.harbors, NAMES.slice(0, NAMES.indexOf(name) + 1), 'the pack keeps every harbor packed before');
      }
      const text = await readFile(file, 'utf8');
      for (const [name, pk] of Object.entries(pks)) assert.ok(!text.includes(pk), `${name}: the pack names no pk, and holds no seed in the clear`);
      return { NERVUR_PACK: text };
    },
    pilot: async (scene: string): Promise<Result[]> => {
      try {
        if (scene === CARRIED) {
          assert.equal((await command(['init', '--dir', mine])).code, 0);
          for (const name of NAMES) {
            const held = await command(['pilot', name, JSON.stringify(owners[name]), '--dir', mine]);
            assert.deepEqual(held.out, { piloting: name, ward: pks[name] }, `${name}: the web carrier opened for the pilot, and the take went over it`);
            assert.deepEqual((await command(['host', `kitchen-${name}`, '--via', name, '--dir', mine])).out, { answer: { hosted: `kitchen-${name}` } });
          }
        }
        for (const name of NAMES) {
          const census = (await command(['census', '--via', name, '--dir', mine])).out as { answer: { notes: { pk: string } } };
          assert.equal(census.answer.notes.pk, pks[name], `${name}: the harbor born on Node, at its own path`);
          const modules = (await command(['modules', '--via', name, '--dir', mine])).out as { answer: { answer: { modules: Record<string, JsonObject> } } };
          assert.equal(modules.answer.answer.modules[law.module]!.running, law.version, `${name}: the module its live holds runs on the edge, found in the bundle by its blob`);
          const kitchen = await command(['host', `kitchen-${name}`, '--via', name, '--dir', mine]);
          assert.deepEqual(kitchen.out, { answer: { error: `kitchen-${name} is hosted already` } }, `${name}: what the pilot did stays, the pack landed once`);
        }
        return [{ name: scene }];
      } catch (e) {
        return [{ name: scene, error: String((e as Error).stack ?? e) }];
      }
    },
    after: async (base: string, restart: Restart): Promise<Result[]> => [
      ...(await around.pilot(CARRIED)),
      ...(await shelled(SHELLED)),
      ...(await concurrent()),
      ...(await shopScene(base, restart, shopInvitation)),
      ...(await around.pilot(CARRIED_AGAIN)),
      ...(await shelled(SHELLED_AGAIN)),
    ],
  };
  return around;
};

let edged: Result[] | undefined;
const WORKERD = { ...TIME, skip: has('workerd') ? false : 'no workerd: npm i -D workerd' };

test(holds('edge.many', 'workerd runs the edge shell as a worker, and one worker carries many harbors by name under one secret'), WORKERD, async () => {
  const results = await inWorkerd(edge, await host.reach(), await host.reach(), carriedEdge());
  edged = results;
  assert.ok(results.filter((r) => r.name.startsWith('edge: law on a durable object')).length > 5, 'the law ran in a child, on its facet storage');
  for (const name of [SHOPPED, CARRIED, CARRIED_AGAIN, SHELLED, SHELLED_AGAIN, CONCURRENT]) assert.ok(results.some((r) => r.name === name), name);
  green(results, 'workerd', 'edge: ');
});

test(holds('edge.shell', 'workerd: live moves on the shell with no deploy, back again, refuses a module that does not load, and stands again across a restart'), WORKERD, () => {
  assert.ok(edged, 'the worker ran');
  for (const name of [SHELLED, SHELLED_AGAIN]) assert.deepEqual(edged.find((r) => r.name === name), { name }, name);
});

test(holds('edge.miss-concurrent', 'workerd: asks that land in a child while another ask misses a module are each answered, asked again in the next child'), WORKERD, () => {
  assert.ok(edged, 'the worker ran');
  assert.deepEqual(
    edged.find((r) => r.name === CONCURRENT),
    { name: CONCURRENT },
    CONCURRENT,
  );
});

test(holds('ground.foreground', 'Chromium runs the browser bundle in a page and its workers, and a harbor in a tab says it is foreground'), TIME, async (t) => {
  let results: Result[];
  try {
    results = await inChromium(page, await host.reach());
  } catch (e) {
    if (/Executable doesn't exist|playwright install/.test(String(e))) return t.skip('no chromium: npx playwright install chromium');
    throw e;
  }
  assert.ok(results.filter((r) => r.name.startsWith('browser: law on indexeddb')).length > 5, 'the law ran on IndexedDB');
  green(results, 'chromium', 'browser: ');
});
