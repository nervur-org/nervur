// SPDX-License-Identifier: Apache-2.0
// The browser harbor in a worker, one for every tab. A shared, dedicated
// or service worker calls `serveWorker` as its script starts, with the
// harbor it opens; every tab reaches that harbor's root line with
// `rootOf`, one request on a channel of its own. A service worker that
// hears a push asks the dock's `heard`, since a push carries nothing but
// the news that something waits.
import type { JsonObject } from '../being/index.ts';
import type { Harbor } from '../harbor/index.ts';

type Asked = { request?: unknown };
type Answering = { postMessage(message: unknown): void };
type Scope = {
  addEventListener(type: string, listener: (event: never) => void): void;
};
type Connecting = { ports: readonly MessagePort[] };
type Messaging = { data: unknown; ports: readonly MessagePort[] };
type Pushing = { waitUntil(work: Promise<unknown>): void };

const answer = async (harbor: Promise<Harbor>, data: unknown, reply: Answering | undefined): Promise<void> => {
  if (!reply) return;
  let out: JsonObject;
  try {
    out = await (await harbor).ask((data as Asked | null)?.request);
  } catch {
    out = { error: 'the harbor threw' };
  }
  reply.postMessage(out);
};

// Called as the worker's script starts, so no tab's first message is
// lost while the harbor opens.
export const serveWorker = (opening: Promise<Harbor>, scope: Scope = globalThis as unknown as Scope): void => {
  // The worker holds the harbor, so it asks its `stand` before any tab's.
  const harbor = opening.then(async (h) => {
    await h.ask({ method: 'stand' });
    return h;
  });
  scope.addEventListener('connect', (event: Connecting) => {
    const port = event.ports[0]!;
    port.onmessage = (message) => void answer(harbor, message.data, message.ports[0]);
    port.start();
  });
  scope.addEventListener('message', (event: Messaging) => void answer(harbor, event.data, event.ports[0]));
  scope.addEventListener('push', (event: Pushing) => event.waitUntil(harbor.then((h) => h.ask({ method: 'heard' }))));
};

// Where a tab sends root requests: a shared worker's port, a dedicated
// worker, or a service worker.
export type Reaching = { postMessage(message: unknown, transfer: Transferable[]): void };

// A tab's root line to the worker's harbor.
export const rootOf =
  (worker: Reaching) =>
  (request: JsonObject): Promise<JsonObject> =>
    new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (message) => {
        channel.port1.close();
        resolve(message.data as JsonObject);
      };
      worker.postMessage({ request }, [channel.port2]);
    });
