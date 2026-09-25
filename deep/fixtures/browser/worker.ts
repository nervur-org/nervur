// The origin's service worker. A push wakes it and names the ground; it
// opens that ground, which it runs where no page holds the lock and reaches
// through the page that runs it otherwise, asks one being, and says what it
// heard on a channel the run listens to. A service worker may not import(),
// so its own build hands the origin faculty the shop's module by its path.
import { BrowserGround } from 'nervur/browser';
import * as shop from './shop.ts';

const modules: Record<string, unknown> = { '/houses/shop.js': shop };

declare const self: { addEventListener(type: 'push', listener: (event: { data: { json(): { name: string } } | null; waitUntil(work: Promise<unknown>): void }) => void): void };

self.addEventListener('push', (event) => {
  const { name } = event.data!.json();
  event.waitUntil(
    (async () => {
      const ground = await BrowserGround.open({
        name,
        platform: {
          load: async (href) => {
            const module = modules[new URL(href).pathname];
            if (module === undefined) throw new Error(`the worker holds no module at ${href}`);
            return module;
          },
        },
      });
      const answer = await ground.hand({ house: 'shop', id: 'bob', method: 'greet' });
      const heard = new BroadcastChannel(`${name}-heard`);
      heard.postMessage({ answer, leading: ground.leading });
      heard.close();
      await ground.close();
    })(),
  );
});
