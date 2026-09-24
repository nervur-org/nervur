// The browser run's origin as static files: the page, the service worker
// and the shop's module, built with a shared chunk so they share one
// `nervur/being`, and the page's index. The run serves them on localhost;
// `node build.ts <folder>` writes them for a deploy to a real origin.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const here = new URL('./', import.meta.url).pathname;

export const buildOrigin = async (out: string): Promise<void> => {
  await build({
    entryPoints: { page: join(here, 'page.ts'), 'houses/shop': join(here, 'shop.ts'), sw: join(here, 'worker.ts') },
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    conditions: ['nervur-source'],
    outdir: out,
    logLevel: 'silent',
  });
  writeFileSync(join(out, 'index.html'), '<!doctype html><script type="module" src="/page.js"></script>\n');
};

if (import.meta.main) {
  const out = process.argv[2];
  if (out === undefined) throw new Error('name the folder to write the origin into');
  await buildOrigin(out);
}
