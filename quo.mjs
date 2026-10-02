// Quo, fetched once at the commit the kit pins, into `quo/` beside the kit.
// The kit's tests walk up to the nearest folder named quo holding SPEC.md
// and read its verifier and vectors there, offline. A folder already at the
// pinned commit is left as it is, so the step runs as often as it is asked
// and touches the network only when the pin moves. The pin is the `quo`
// field of the kit's manifest, and the public gate runs this same step.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { quo } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));
const into = fileURLToPath(new URL('../quo/', import.meta.url));
const git = (...args) => execFileSync('git', ['-C', into, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

if (existsSync(new URL('../quo/.git', import.meta.url)) && git('rev-parse', 'HEAD') === quo.commit) process.exit(0);
mkdirSync(into, { recursive: true });
if (!existsSync(new URL('../quo/.git', import.meta.url))) git('init', '-q');
git('fetch', '-q', '--depth', '1', quo.repository, quo.commit);
git('checkout', '-q', '--force', '--detach', quo.commit);
git('clean', '-q', '-d', '-f', '-x');
