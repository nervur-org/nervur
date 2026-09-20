// SPDX-License-Identifier: Apache-2.0
// What every engine dials: a harbor on Node listening for Quo over the
// web and TCP, hosting a shop. Each engine is handed fresh invitations, so
// no two runs take the same one.
import { DEFAULTS, Harbor, type JsonObject } from '../../src/index.ts';
import { webServe } from '../../src/core/http/index.ts';
import { PointerTerrain } from '../../src/core/pointer/index.ts';
import { NodeSockets } from '../../src/core/tcp/index.ts';
import { LAW } from '../../src/core/proof/index.ts';
import type { Reach } from './exercise.ts';

export const stand = async () => {
  const harbor = await Harbor.open(new PointerTerrain({ defaults: DEFAULTS, web: webServe, tcp: () => new NodeSockets() }));
  const root = async (method: string, args: JsonObject = {}, ward?: string): Promise<JsonObject> => {
    const out = await harbor.ask({ ...(ward === undefined ? {} : { ward }), method, args });
    return ('answer' in out ? out.answer : out) as JsonObject;
  };
  const faculty = async (being: string, method: string, args: JsonObject = {}) => ((await root('ask', { being, method, args })) as { answer: JsonObject }).answer;
  await faculty('catalogue', 'add', { source: LAW });
  await root('open', { key: 'web', class: 'org.nervur.web' });
  const [post, held] = (await faculty('web', 'listen', { path: '/quo' })).at as [string, string];
  await root('open', { key: 'tcp', class: 'org.nervur.tcp' });
  const tcp = (await faculty('tcp', 'listen')).at as string;
  await root('reach', { at: [post] });
  await root('host', { ward: 'shop' });
  await root('boot', { key: 'shop', class: 'org.example.shop' }, 'shop');
  let n = 0;
  const reach = async (): Promise<Reach> => {
    n += 1;
    const shop = await root('invite', { being: 'shop', id: `engine${String(n)}` }, 'shop');
    const probe = await root('invite', { being: 'shop', id: `probed${String(n)}` }, 'shop');
    return { post, held, tcp, shop, probe };
  };
  const close = () => harbor.close();
  return { reach, close };
};
