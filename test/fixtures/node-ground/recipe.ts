// A ground's registry, stood by the faculty `module`: one faculty, `echo`,
// whose body answers beings through its blueprint and people through its
// handler at /echo, its prefix from its entry's args and its signature
// from a secret of the dock.
import { Faculty, OK, type Handler, type Registry, type Status } from 'nervur';
import { s } from 'nervur/being';
import { Echo } from './echo.ts';

class EchoFaculty extends Faculty {
  static override readonly blueprint = Echo;
  static override readonly takes = { args: s.object({ prefix: s.optional(s.string()) }), secrets: { signature: 'the words it signs with' } };
  #signature = '';
  override readonly handler: Handler = {
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      return url.pathname === '/echo' ? new Response(url.searchParams.get('text') ?? '') : null;
    },
  };
  override up(): Status {
    this.#signature = this.made.secrets.signature;
    return OK;
  }
  async say({ text }: { text: string }) {
    return { result: `${String(this.made.args.prefix ?? '')}${text} ${this.#signature}` };
  }
}

export const faculties: Registry['faculties'] = { echo: EchoFaculty };
