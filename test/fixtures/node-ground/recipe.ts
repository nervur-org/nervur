// A ground's recipe: one faculty, `echo`, which answers beings through its
// blueprint and people through its handler at /echo.
import type { Faculty } from 'nervur';
import { Echo } from './echo.ts';

export const faculties = ({ env }: { env: Readonly<Record<string, string | undefined>> }): Record<string, Faculty> => ({
  echo: {
    blueprint: Echo,
    object: { say: async ({ text }: { text: string }) => ({ result: `${env.ECHO_PREFIX ?? ''}${text}` }) },
    handler: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        return url.pathname === '/echo' ? new Response(url.searchParams.get('text') ?? '') : null;
      },
    },
  },
});
