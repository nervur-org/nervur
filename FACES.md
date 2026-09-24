# Faces

A face is how a person with no house of their own reaches a being: a
site, an API, or a server of tools for an AI agent. It adds nothing new
to the library. A face is a faculty with a handler on the ground's
listener, and the person behind it is one occupant of one being. This
guide writes one face that serves an API and tools together.
[Writing for nervur](AUTHORING.md) teaches beings, and [Writing a
faculty](FACULTIES.md) teaches faculties.

## Doors and tokens

**A person reaches a house in one of two ways.** Their own house holds a
standing and asks over Quo, or a face asks for them with a token. Nothing
else reaches a being.

**A token is a door.** A being mints an occupant for the person. The face
receives it as a token, since a face is a faculty, and a faculty calls a
handle by its token. The face asks as that occupant, so the being's roles
decide what the person may do, and the face decides nothing.

**A token reads the describe, and asks by method.** Asked with no method,
a token answers what its occupant may ask now, with each ask's schema. So
an API face shows those asks as endpoints and a tool server as tools, and
the owner writes the business once.

**One ask gives every other door.** The person's being mints another
occupant for a device, an agent or an API client, each under notes of its
own. It lists its doors and lets any one go.

## The desk

The steward arms the face with a handle to her `signup`. Each person who
signs up is a member being, and the face holds one door on her. A member
declares the face as a need, so the ground's grant decides which classes
a face reaches.

```ts
// desk.ts
import { Being, need, s, type Args } from 'nervur/being';

/** The face, as the steward arms it with a handle to her signup. */
const Face = need('face', {
  arm: { args: s.object({ signup: s.handle() }), hints: { idempotent: true } },
});

/** A member declares the face, so its doors reach her. */
const Reached = need('face', {});

export class Desk extends Being.of({
  kind: 'com.example.desk',
  needs: { face: Face },
  asks: {
    arm: { for: 'root', hints: { idempotent: true } },
    signup: { for: 'handle', args: s.object({ name: s.string() }), result: s.object({ door: s.handle() }) },
  },
}) {
  async arm() {
    await this.face.arm({ signup: this.handle('signup') });
  }

  // Each person is one member, and the face holds one door on her.
  signup({ name }: Args<Desk, 'signup'>) {
    const id = `member-${name}`;
    this.powers!.bear({ kind: 'com.example.member', id });
    return { door: this.powers!.invite({ id, occupant: 'web', notes: { person: true } }) };
  }
}

export class Member extends Being.of({
  kind: 'com.example.member',
  needs: { face: Reached },
  cells: { visits: 0 },
  roles: { person: (asker) => asker.steward.person === true },
  asks: {
    hello: { for: 'person', hints: { readOnly: true }, description: 'Greets the person.', result: s.string() },
    visit: { for: 'person', description: 'Counts one visit.', result: s.integer() },
    leave: { for: 'person', description: 'Lets this door go.' },
  },
}) {
  hello() {
    return `hello, ${this.id}`;
  }

  visit() {
    this.cells.visits += 1;
    return this.cells.visits;
  }

  leave() {
    this.occupants.dismiss(this.asker.id);
  }
}

export const steward = Desk;
export const beings = [Member];
```

## The face

The face keeps the context its `arm` was called with, and calls every
token through it. Its handler answers the requests that are its own and
passes on every other, so it shares the listener with Quo and any other
face. Each call carries an id of the face's own, so a call the house
tries again acts once.

```ts
// api.ts
import type { Faculty, FacultyContext, Handler } from 'nervur';
import { need, s, type Json } from 'nervur/being';

type Answer = Awaited<ReturnType<FacultyContext['call']>>;
type Entry = { method: string; description?: string; args?: Json; hints?: Json };

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
  #context: FacultyContext | undefined;
  #signup = '';
  #calls = 0;

  arm({ signup }: { signup: string }, context: FacultyContext): Promise<Answer> {
    this.#context = context;
    this.#signup = signup;
    return Promise.resolve({ result: null });
  }

  #held(): FacultyContext {
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

/** The offer a ground hands: the blueprint, the object, and its handler on the ground's listener. */
export const apiOffer = (api: Api): Faculty => ({ blueprint: FaceBlueprint, object: api, handler: api.handler });
```

**The describe maps onto tools by renaming.** An ask is a tool, its
method the tool's name, its args schema the tool's input schema, and its
hints the tool's annotations. A moved describe is a changed list of
tools.

## The recipe

The ground makes the face from its recipe, as it makes any faculty. The
house's entry names `face` among its faculties, and the steward's `arm`
hands the face its signup.

```ts
// recipe.ts
import { Api, apiOffer } from './api.ts';

export const faculties = () => ({
  face: apiOffer(new Api()),
});
```

## Testing it

A BenchGround answers a request with its faculties' handlers in turn, as
a ground's one listener does, so the face is tested with no socket.

```ts
// api.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as desk from './desk.ts';
import { faculties } from './recipe.ts';

test('A person signs up at the face, and reaches their member as an API and as tools', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'desk', modules: { desk }, recipe: faculties });
  t.after(() => ground.down());
  await ground.add('desk', 'desk', { faculties: ['face'] });
  await ground.ask({ house: 'desk', method: 'arm' });
  const web = async (path: string, body?: unknown, token?: string) =>
    (await ground.fetch(
      new Request(`https://desk.example${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )).json() as Promise<Record<string, unknown>>;

  const { token } = (await web('/signup', { name: 'ada' })) as { token: string };
  const { describe } = (await web('/api', undefined, token)) as { describe: { asks: { method: string }[] } };
  assert.deepEqual(describe.asks.map(({ method }) => method).sort(), ['hello', 'leave', 'visit']);
  assert.deepEqual(await web('/api/hello', {}, token), { result: 'hello, member-ada' });
  assert.deepEqual(await web('/api/visit', {}, token), { result: 1 });

  const { result } = (await web('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, token)) as { result: { tools: { name: string; annotations: { readOnly?: boolean } }[] } };
  assert.equal(result.tools.find(({ name }) => name === 'hello')?.annotations.readOnly, true, 'a hint is an annotation');
  const called = await web('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'visit' } }, token);
  assert.deepEqual(called.result, { content: [{ type: 'text', text: '2' }], isError: false });

  assert.deepEqual(await web('/api/leave', {}, token), { result: null });
  assert.deepEqual(await web('/api/hello', {}, token), { error: { message: 'no such token' } }, 'a door let go is no door');
});
```

## Further than one door

**A watch reaches a page as events.** A token's call takes `after`, the
answer the face holds, and makes a `readOnly` ask a watch. It answers the
moment the answer changes, so a face streams it as server-sent events.

**A door carried home leaves as an invitation.** A token's call takes
`home: true`. The handles in its answer then reach the face as invitation
bytes, never as tokens. The person carries them to a house of their own,
which takes them. Their being, its cells and its history stay, and the old
token is let go.

**A session gives every other door.** A browser session is one door.
Through it the person's being mints another for an agent or an API
client, so an OAuth server is a face that turns that ask into its
client's access token.
