// The guides' code is files the suites run, block for block, so what a
// stranger copies is what is proven. A shell block is a command, and no file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const blocks = (guide: string) => [...read(`../${guide}`).matchAll(/```(\w+)\n([\s\S]*?)```/g)].filter((match) => match[1] !== 'bash' && match[1] !== 'text').map((match) => match[2]);

const held = (guide: string, folder: string, files: readonly string[]) => {
  test(`Every code block of ${guide} is a file the suites run, in order`, () => {
    const found = blocks(guide);
    assert.equal(found.length, files.length, `${guide} holds ${found.length} blocks`);
    files.forEach((file, index) => assert.equal(found[index], read(`fixtures/${folder}/${file}`), file));
  });
};

held('README.md', 'readme', ['greeter.ts', 'greeter.test.ts', 'house/index.ts', 'page.ts']);
held('AUTHORING.md', 'guides', ['classes/order.ts', 'classes/shop.ts', 'classes/lobby.ts', 'order.test.ts', 'payments.ts', 'recipe.ts', 'classes/index.ts']);
