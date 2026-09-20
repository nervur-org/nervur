// SPDX-License-Identifier: Apache-2.0
// What an engine's own V8 says about the terrain run, taken over that
// engine's inspector and written beside Node's own coverage so `cover`
// maps both back to `src/` and counts them as one. Nothing here runs
// unless `NERVUR_COVER` names a directory, so `deep` is untouched.
//
// Chromium answers precise coverage, block ranges and all, but only to a
// client attached to the BROWSER target: a page's session never sees a
// shared or a service worker, so this speaks raw CDP over the browser's
// own WebSocket, auto-attaches flat, and starts the profiler on each
// session before that session's code runs.
//
// workerd's inspector swallows `Profiler.enable`, so precise coverage is
// out of reach there. `Profiler.getBestEffortCoverage` answers for the
// worker and every Durable Object of the isolate at once, and is asked of
// each child the Worker Loader made too, with one range per function, which makes its function counts honest and its line and
// branch numbers worthless. `cover` throws those away.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// The directory `cover` set, or nothing, which means collect nothing.
export const covering = (): string | undefined => process.env.NERVUR_COVER;

// One engine's V8 payload: the bundle it ran, so the inline source map
// travels with the ranges, and the scripts that are that bundle.
export type Script = { scriptId: string; url: string; functions: unknown[] };
export type Payload = { engine: string; precise: boolean; source: string; scripts: Script[] };

let files = 0;
export const keep = async (engine: string, precise: boolean, source: string, scripts: Script[]): Promise<void> => {
  const dir = covering();
  if (!dir || scripts.length === 0) return;
  const payload: Payload = { engine, precise, source, scripts };
  await writeFile(join(dir, `engine-${engine}-${String(files++)}.json`), JSON.stringify(payload));
};

// A script of the bundle, not of a shim: workerd serves its own
// `wasm-instantiate-shim.js` under the same isolate, and its ranges
// corrupt the file it is merged into.
const isBundle = (script: { functions: unknown[] }): boolean => script.functions.length > 50;

// Chromium's bundle, by the paths it is served at: the page's module, and
// the shared and service workers' scripts, which are the bundle with one
// line after it. Playwright injects its own scripts into every page, some
// as large as the bundle, and their ranges mapped through the bundle's map
// land on whatever source their offsets fall in.
const SERVED = ['/nervur.js', '/worker.js', '/sw.js'];
const isServed = (script: Script): boolean => {
  try {
    return SERVED.includes(new URL(script.url).pathname);
  } catch {
    return false;
  }
};

type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: unknown; sessionId?: string };
type Cdp = {
  send(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<Message>;
  on(listener: (message: Message) => void): void;
  close(): void;
};

// A flat CDP connection: one socket, every session addressed by its id.
const connect = async (url: string): Promise<Cdp> => {
  const socket = new WebSocket(url);
  await new Promise<void>((done, fail) => {
    socket.addEventListener('open', () => done());
    socket.addEventListener('error', () => fail(new Error(`no inspector at ${url}`)));
  });
  let last = 0;
  const pending = new Map<number, (message: Message) => void>();
  const listeners: ((message: Message) => void)[] = [];
  socket.addEventListener('message', (event: MessageEvent) => {
    const message = JSON.parse(String(event.data)) as Message;
    const answer = message.id === undefined ? undefined : pending.get(message.id);
    if (answer) {
      pending.delete(message.id!);
      answer(message);
      return;
    }
    for (const listener of listeners) listener(message);
  });
  return {
    send: (method, params = {}, sessionId) =>
      new Promise<Message>((done) => {
        const mine = ++last;
        pending.set(mine, done);
        socket.send(JSON.stringify({ id: mine, method, params, ...(sessionId ? { sessionId } : {}) }));
      }),
    on: (listener) => listeners.push(listener),
    close: () => socket.close(),
  };
};

// The browser's own WebSocket, found by asking the debugging port.
const browserSocket = async (port: number, deadline: number): Promise<string> => {
  while (Date.now() < deadline) {
    const version = await fetch(`http://127.0.0.1:${String(port)}/json/version`)
      .then((r) => r.json() as Promise<{ webSocketDebuggerUrl?: string }>)
      .catch(() => undefined);
    if (version?.webSocketDebuggerUrl) return version.webSocketDebuggerUrl;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error(`chromium's debugging port ${String(port)} never answered`);
};

// Chromium, watched from the moment it starts: every page and worker it
// attaches is held at its first statement, has the profiler started, and
// is then let go. `harvest` takes what each one ran.
export type Harvest = () => Promise<void>;
export const watchChromium = async (port: number, source: string, deadline: number): Promise<Harvest> => {
  const cdp = await connect(await browserSocket(port, deadline));
  const sessions = new Set<string>();
  cdp.on((message) => {
    if (message.method !== 'Target.attachedToTarget') return;
    const { sessionId, targetInfo } = message.params as { sessionId: string; targetInfo: { type: string } };
    const wanted = ['page', 'worker', 'shared_worker', 'service_worker'].includes(targetInfo.type);
    void (async () => {
      if (wanted) {
        await cdp.send('Profiler.enable', {}, sessionId);
        await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true }, sessionId);
        sessions.add(sessionId);
      }
      await cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId);
    })();
  });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  return async () => {
    const scripts: Script[] = [];
    for (const sessionId of sessions) {
      const taken = await cdp.send('Profiler.takePreciseCoverage', {}, sessionId);
      for (const script of (taken.result?.result ?? []) as Script[]) if (isServed(script)) scripts.push(script);
    }
    await keep('chromium', true, source, scripts);
    cdp.close();
  };
};

// workerd, asked once before it is killed: each isolate's best effort,
// which is every function the worker and its objects entered. Each child
// the Worker Loader made is an isolate of its own and a target of the
// inspector of its own, `LOADER:<id>`, running the kit as the module
// `nervur`, so its functions are read against the kit's text, the one
// with the edge scenes inside for the scenes' child.
export const takeWorkerd = async (port: number, source: string, kits: { kit: string; scenes: string }, deadline: number): Promise<void> => {
  const list = async (): Promise<{ id: string; webSocketDebuggerUrl: string }[]> => {
    while (Date.now() < deadline) {
      const answer = await fetch(`http://127.0.0.1:${String(port)}/json/list`)
        .then((r) => r.json() as Promise<{ id: string; webSocketDebuggerUrl: string }[]>)
        .catch(() => undefined);
      if (answer) return answer;
      await new Promise((r) => setImmediate(r));
    }
    throw new Error(`workerd's inspector on ${String(port)} never answered`);
  };
  for (const target of await list()) {
    const cdp = await connect(target.webSocketDebuggerUrl);
    const best = await cdp.send('Profiler.getBestEffortCoverage');
    cdp.close();
    const scripts = ((best.result?.result ?? []) as Script[]).filter(isBundle);
    if (target.id === 'main') await keep('workerd', false, source, scripts);
    else await keep('workerd', false, target.id === 'LOADER:scenes' ? kits.scenes : kits.kit, scripts.filter((s) => s.url === 'nervur'));
  }
};
