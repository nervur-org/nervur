// A face, reduced to what the house sees of one: a faculty the steward
// arms with a handle to her `enroll`, which signs a person up and hands
// back a door on that person's member being. The face then asks through
// each door it holds, as that door's occupant, and reads its describe.
import type { FacultyContext } from 'nervur';
import { need, s, type Json } from 'nervur/being';

type Answer = Awaited<ReturnType<FacultyContext['call']>>;

/** What the steward arms the face with. */
export const FrontBlueprint = need('front', {
  arm: { args: s.object({ signup: s.handle() }), hints: { idempotent: true } },
});

export class Front {
  #context: FacultyContext | undefined;
  #signup: string | undefined;
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

  /** A person signs up, and the face holds the token of their door. */
  async signup(name: string): Promise<string> {
    const answered = await this.#held().call({ token: this.#signup!, args: { name }, id: `signup:${name}` });
    if (!('result' in answered)) throw new Error(JSON.stringify(answered));
    return (answered.result as { door: string }).door;
  }

  /** The signup handle asked by another method, which its one ask refuses. */
  enrollAs(method: string): Promise<Answer> {
    return this.#held().call({ token: this.#signup!, method, args: { name: 'x' }, id: `signup-as:${method}` });
  }

  /** One ask through a door, as its occupant; `after` makes a readOnly one a watch. */
  ask(token: string, method: string | undefined, args: Json = {}, after?: Answer): Promise<Answer> {
    return this.#held().call({ token, ...(method === undefined ? {} : { method }), args, id: `call:${++this.#calls}`, ...(after === undefined ? {} : { after }) });
  }

  /** One ask through a door whose answer's handles are carried home, as invitation bytes. */
  carryHome(token: string, method: string): Promise<Answer> {
    return this.#held().call({ token, method, args: {}, id: `call:${++this.#calls}`, home: true });
  }

  /** What a door's occupant may ask now. */
  describe(token: string) {
    return this.#held().describe({ token });
  }

  /**
   * The face on the ground's listener: `GET /` with a bearer token reads
   * its describe, and `POST /<ask>` asks with the body as args.
   */
  readonly handler = {
    fetch: async (request: Request): Promise<Response | null> => {
      const path = new URL(request.url).pathname;
      const token = /^Bearer (\w+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
      if (token === undefined) return new Response(null, { status: 401 });
      if (request.method === 'GET' && path === '/') return Response.json(await this.describe(token));
      if (request.method === 'POST') return Response.json(await this.ask(token, path.slice(1), (await request.json()) as Json));
      return null;
    },
  };
}
