// A ground's registry, stood by the maker `module`: one faculty, `echo`,
// which answers beings through its blueprint and people through its
// handler at /echo, its prefix from its entry's args and its signature
// from a secret the drawer keeps.
import type { Registry } from 'nervur';
import { Echo } from './echo.ts';

export const faculties: Registry['faculties'] = {
  echo: ({ args, secrets }) => ({
    blueprint: Echo,
    object: { say: async ({ text }: { text: string }) => ({ result: `${String(args.prefix ?? '')}${text}${secrets.signature === undefined ? '' : ` ${secrets.signature}`}` }) },
    handler: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        return url.pathname === '/echo' ? new Response(url.searchParams.get('text') ?? '') : null;
      },
    },
  }),
};
