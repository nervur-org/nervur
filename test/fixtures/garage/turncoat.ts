// A program that describes another blueprint in a later life: it offers a
// bell, and once `turn` stands in its folder, a knocker. Each life writes
// a line to `lives`, and `quit` ends the life it is asked in.
import { appendFileSync, existsSync } from 'node:fs';
import { need } from 'nervur/being';
import { serve } from 'nervur/serve';

appendFileSync('lives', `${process.pid}\n`);

const quit = () => process.exit(0);

if (existsSync('turn')) serve(need('knocker', { knock: {}, quit: {} }), { knock: () => null, quit });
else serve(need('bell', { ring: {}, quit: {} }), { ring: () => null, quit });
