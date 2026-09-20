// SPDX-License-Identifier: Apache-2.0
// The kit as one module's text, which an edge's shell hands each child it
// loads: the Workers entry and the edge ground bundled whole, its two
// dependencies inside, so a module's `'nervur'` names it in the child.
// `npm run build` writes it as `dist/core/edge/kit.js` after `tsc`, and the
// terrain run builds it the same way from the source.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// The kit's text from an entry that names the Workers entry and the edge
// ground at `edge` and `ground`.
export const kitText = async ({ edge, ground, resolveDir, minify = true, plugins = [], sourcemap = false, extra = '' }) => {
  const contents = `export * from ${JSON.stringify(edge)};\nexport * from ${JSON.stringify(ground)};\n${extra}`;
  const out = await build({
    stdin: { contents, resolveDir, loader: 'ts', sourcefile: 'kit.ts' },
    plugins,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['import', 'default'],
    target: 'es2023',
    external: ['cloudflare:*'],
    minify,
    write: false,
    // A map's sources are relative to `resolveDir`, as a reader of the map
    // resolves them.
    ...(sourcemap ? { sourcemap: 'inline', absWorkingDir: resolveDir } : {}),
  });
  return out.outputFiles[0].text;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = fileURLToPath(new URL('./dist/', import.meta.url));
  const text = await kitText({ edge: './edge.js', ground: './core/edge/index.js', resolveDir: dist });
  await writeFile(new URL('./dist/core/edge/kit.js', import.meta.url), `// The kit as one module's text, for an edge's shell.\nexport default ${JSON.stringify(text)};\n`);
  await writeFile(new URL('./dist/core/edge/kit.d.ts', import.meta.url), 'declare const kit: string;\nexport default kit;\n');
}
