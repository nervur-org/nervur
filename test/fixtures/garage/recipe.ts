// recipe.ts
import { fileURLToPath } from 'node:url';
import { bridge, type Recipe } from 'nervur/node';

const relay = fileURLToPath(new URL('./relay.py', import.meta.url));

// The relay runs in a folder of its own, granted to the twin's class alone.
export const faculties: NonNullable<Recipe['faculties']> = ({ dir }) => ({
  relay: dir('relay').then(async (cwd) => ({ ...(await bridge({ command: 'python3', args: [relay], cwd })), kinds: ['org.example.garage'] })),
});
