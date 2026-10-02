// SPDX-License-Identifier: Apache-2.0
// The module a runner's thread starts from, on the engine it finds: a Node
// worker thread, or a Web Worker. It keeps what the runner needs of its
// engine, lets a rejection a species left unawaited die here, and hands
// the rest to the runner, which takes every other global away before any
// class loads. The runner loads after, so on Node the engine's compile
// cache holds it.

interface NodePort {
  postMessage(message: unknown): void;
  on(event: 'message', heard: (message: unknown) => void): void;
}

interface NodeProcess {
  getBuiltinModule(id: string): unknown;
  on(event: string, listener: () => void): void;
}

interface Hooks {
  enableCompileCache?(): unknown;
}

interface WorkerScope {
  postMessage(message: unknown): void;
  addEventListener(type: string, listener: (event: { readonly data?: unknown; preventDefault(): void }) => void): void;
}

const node = (globalThis as { process?: NodeProcess }).process;
const parent = (node?.getBuiltinModule('node:worker_threads') as { parentPort: NodePort | null } | undefined)?.parentPort;

if (node !== undefined && parent !== null && parent !== undefined) {
  // What a species throws or leaves unawaited ends her ask, never the thread.
  node.on('unhandledRejection', () => undefined);
  node.on('uncaughtException', () => undefined);
  const modules = node.getBuiltinModule('node:module') as Hooks;
  // Each runner compiles the same library, so the engine keeps what it compiled for the next.
  modules.enableCompileCache?.();
  const immediate = globalThis.setImmediate;
  const { inside } = await import('./inside.ts');
  inside({ post: (message) => parent.postMessage(message), listen: (heard) => parent.on('message', heard) }, { turn: (next) => immediate(next) });
} else {
  const scope = globalThis as unknown as WorkerScope;
  const post = scope.postMessage.bind(scope);
  const listen = scope.addEventListener.bind(scope);
  listen('unhandledrejection', (event) => event.preventDefault());
  listen('error', (event) => event.preventDefault());
  const later = globalThis.setTimeout;
  const { inside } = await import('./inside.ts');
  inside({ post, listen: (heard) => listen('message', (event) => heard(event.data)) }, { turn: (next) => later(next, 0) });
}
