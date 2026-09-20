// SPDX-License-Identifier: Apache-2.0
// The worker workerd runs: the neutral exercise, the edge scenes in a child
// the Worker Loader makes of the terrain kit, as a facet of an object of
// their own for each run, and every other path to the harbor it names, a
// shell over the kit `nervur/edge/kit` is built as.
import kit from 'nervur:kit';
import * as built from 'nervur:law';
import scenesKit from 'nervur:scenes-kit';
import { harborShell, harborWorker, readPack, type EdgeEnv, type ShellEnv, type WorkerLoader } from '../../src/core/edge/index.ts';
import type { Reach, Result } from './exercise.ts';

// The law's module as the worker's bundler built it, which the neutral
// exercise runs its harbors from, since a worker imports no source.
(globalThis as { nervurLaw?: unknown }).nervurLaw = built;

// Every harbor of the worker, one class, each an object by its name under
// one NERVUR_SECRET, carried in the pack `nervur edge pack` wrote.
export const Harbors = harborShell({
  kit,
  pack: (env) => {
    const text = (env as { NERVUR_PACK?: string }).NERVUR_PACK;
    return text === undefined ? undefined : (readPack(JSON.parse(text)) ?? undefined);
  },
});

const SCENES = `import { DurableObject } from 'cloudflare:workers';
import { EdgeScenes } from 'nervur';
export class Scenes extends DurableObject {
  fetch(request) { return new EdgeScenes(this.ctx, this.env).fetch(request); }
}
`;

type Facet = { fetch(request: Request): Promise<Response> };
type ScenesState = { readonly facets: { get(name: string, start: () => Promise<{ class: unknown }>): Facet } };

// The edge scenes, in a child of their own on the facet's storage.
export class EdgeExercise {
  readonly #state: ScenesState;
  readonly #env: ShellEnv;
  constructor(state: ScenesState, env: ShellEnv) {
    this.#state = state;
    this.#env = env;
  }

  fetch(request: Request): Promise<Response> {
    const loader = this.#env.LOADER as WorkerLoader;
    const env = { NERVUR_SECRET: this.#env.NERVUR_SECRET };
    const worker = loader.get('scenes', () => Promise.resolve({ compatibilityDate: '2026-09-01', mainModule: 'scenes.js', modules: { 'scenes.js': { js: SCENES }, nervur: { js: scenesKit } }, env }));
    return this.#state.facets.get('scenes', () => Promise.resolve({ class: worker.getDurableObjectClass('Scenes') })).fetch(request);
  }
}

type Namespace = { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } };
type WorkerEnv = EdgeEnv & { EXERCISE: Namespace; HARBOR: Namespace };

// The harbors' worker is made per request, since workerd's coverage reads
// a function run as the module loads as never entered.
export const worker = (run: (reach: Reach) => Promise<Result[]>) => ({
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') return Response.json(await run((await request.json()) as Reach));
    if (url.pathname === '/edge') return env.EXERCISE.get(env.EXERCISE.idFromName(url.searchParams.get('run') ?? 'run')).fetch(request);
    return harborWorker().fetch(request, env);
  },
});
