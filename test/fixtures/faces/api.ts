// api.ts
import type { Body, FacultyContext, Handler } from 'nervur';
import { need, s, type Json } from 'nervur/being';

type Answer = Awaited<ReturnType<FacultyContext['call']>>;
type Entry = { method: string; description?: string; args?: Json; hints?: Json };
type Calls = Pick<FacultyContext, 'call' | 'describe'>;

/** What the steward arms the face with. */
export const FaceBlueprint = need('face', {
  arm: { args: s.object({ signup: s.handle() }), hints: { idempotent: true } },
});

/**
 * One face, two ways in. `POST /signup` makes a person's door and answers
 * its token. With the token as a bearer, `GET /api` lists what the door
 * may ask, `POST /api/<ask>` asks it, and `POST /mcp` speaks the same
 * asks to an agent as tools.
 */
export class Api {
  #context: Calls | undefined;
  #signup = '';
  #calls = 0;

  arm({ signup }: { signup: string }, context: FacultyContext): Promise<Answer> {
    this.#context = context;
    this.#signup = signup;
    return Promise.resolve({ result: null });
  }

  // Told its house opened: every door's token answers from the first request, after any restart.
  opened(context: Calls): void {
    this.#context = context;
  }

  #held(): Calls {
    if (this.#context === undefined) throw new Error('the face is not armed');
    return this.#context;
  }

  // Each call its own id, so a call the house retries acts once.
  #ask(token: string, method: string, args: Json): Promise<Answer> {
    return this.#held().call({ token, method, args, id: `api:${++this.#calls}` });
  }

  async #tools(token: string): Promise<Json> {
    const described = await this.#held().describe({ token });
    if (!('describe' in described)) return { error: described.error };
    const asks = (described.describe as { asks: Entry[] }).asks;
    return { tools: asks.map(({ method, description, args, hints }) => ({ name: method, description: description ?? '', inputSchema: args ?? { type: 'object' }, annotations: hints ?? {} })) };
  }

  readonly handler: Handler = {
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      if (request.method === 'POST' && path === '/signup') {
        const { name } = (await request.json()) as { name: string };
        const answer = await this.#held().call({ token: this.#signup, args: { name }, id: `signup:${name}` });
        return 'result' in answer ? Response.json({ token: (answer.result as { door: string }).door }) : Response.json(answer, { status: 400 });
      }
      const token = /^Bearer (\w+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
      if (path !== '/api' && !path.startsWith('/api/') && path !== '/mcp') return null;
      if (token === undefined) return new Response(null, { status: 401 });
      if (request.method === 'GET' && path === '/api') return Response.json(await this.#held().describe({ token }));
      if (request.method === 'POST' && path.startsWith('/api/')) return Response.json(await this.#ask(token, path.slice('/api/'.length), (await request.json()) as Json));
      if (request.method === 'POST' && path === '/mcp') {
        const { id, method, params } = (await request.json()) as { id: number; method: string; params?: { name: string; arguments?: Json } };
        if (method === 'tools/list') return Response.json({ jsonrpc: '2.0', id, result: await this.#tools(token) });
        if (method === 'tools/call') {
          const answer = await this.#ask(token, params?.name ?? '', params?.arguments ?? {});
          const text = JSON.stringify('result' in answer ? (answer.result ?? null) : answer.error.message);
          return Response.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: 'error' in answer } });
        }
        return Response.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'no such method' } });
      }
      return null;
    },
  };
}

/** The face as a body. */
export const apiOffer = (api: Api): Body => ({ blueprint: FaceBlueprint, object: api, handler: api.handler, opened: (context) => api.opened(context) });
