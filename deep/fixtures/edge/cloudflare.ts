// A Worker on the Cloudflare account, as a deploy writes one: the module
// `built` wrote, its Durable Object namespace kept in SQLite, its two
// secrets, and its workers.dev address. Or an origin of static files alone.
// The account is named by CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
//
// The deep Workers stand on the account between runs, and each run deploys
// a new version over them. A script made fresh reaches Cloudflare's nodes
// one by one for about a minute, and waiting that out would flood the
// account with asks. A new version of a standing script answers at once,
// and evicts every object it runs.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const token = process.env.CLOUDFLARE_API_TOKEN ?? '';
const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
const API = `https://api.cloudflare.com/client/v4/accounts/${account}/workers`;

const TYPES: Readonly<Record<string, string>> = { '.html': 'text/html', '.js': 'text/javascript' };

/** Whether the account is named, so a run can reach it. */
export const named = token !== '' && account !== '';

/** A secret of the deep Workers, the same on every run, since a standing object keeps what it sealed under it. */
export const secret = (label: string): string => createHash('sha256').update(`nervur-deep:${label}:${token}`).digest('hex');

const call = async (path: string, init: RequestInit = {}): Promise<unknown> => {
  const response = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...init.headers } });
  const answer = (await response.json()) as { success: boolean; errors: unknown[]; result: unknown };
  if (!answer.success) throw new Error(`${init.method ?? 'GET'} ${path}: ${JSON.stringify(answer.errors)}`);
  return answer.result;
};

// Whether the script stands on the account already.
const stands = async (name: string): Promise<boolean> => {
  const response = await fetch(`${API}/scripts/${name}/settings`, { headers: { authorization: `Bearer ${token}` } });
  await response.body?.cancel();
  return response.ok;
};

/** The module in `out` deployed as `name`, with `secrets` bound, and the origin it answers at. Its first deploy makes its namespace; a later one is a new version. */
export const deployed = async (out: string, name: string, module: string, secrets: Readonly<Record<string, string>>): Promise<string> => {
  const first = !(await stands(name));
  const metadata = {
    main_module: `${module}.js`,
    compatibility_date: '2026-09-01',
    bindings: [{ type: 'durable_object_namespace', name: 'GROUND', class_name: 'Ground' }, ...Object.entries(secrets).map(([key, text]) => ({ type: 'secret_text', name: key, text }))],
    ...(first ? { migrations: { new_tag: 'v1', new_sqlite_classes: ['Ground'] } } : {}),
  };
  const form = new FormData();
  form.set('metadata', JSON.stringify(metadata));
  form.set(`${module}.js`, new Blob([readFileSync(join(out, `${module}.js`))], { type: 'application/javascript+module' }), `${module}.js`);
  await call(`/scripts/${name}`, { method: 'PUT', body: form });
  return live(name, (response) => !(response.headers.get('content-type')?.includes('text/html') ?? false), '/nervur/hand');
};

// The script's workers.dev address, where it answers of its own. Until its route reaches the edge, the address answers
// Cloudflare's own page, which the Worker never does; `/` is its index, and a hand never answers HTML.
const live = async (name: string, ready = (response: Response) => response.ok, path = '/'): Promise<string> => {
  await call(`/scripts/${name}/subdomain`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  const { subdomain } = (await call('/subdomain')) as { subdomain: string };
  const origin = `https://${name}.${subdomain}.workers.dev`;
  // One ask: a standing script answers at once, and a loop of asks would flood the account.
  const response = await fetch(`${origin}${path}`, path === '/' ? {} : { method: 'POST', body: '{}' });
  await response.body?.cancel();
  if (!ready(response)) throw new Error(`${origin} was made on this run and reaches every Cloudflare node in about a minute: run again then`);
  return origin;
};

/** Every file in `out` deployed as `name`'s static assets, with no module of its own, and the origin it answers at. */
export const assetsDeployed = async (out: string, name: string): Promise<string> => {
  const files = readdirSync(out, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = `/${relative(out, join(entry.parentPath, entry.name))}`;
      const body = readFileSync(join(out, path)).toString('base64');
      return { path, body, hash: createHash('sha256').update(body + extname(path)).digest('hex').slice(0, 32), size: statSync(join(out, path)).size };
    });
  const manifest = Object.fromEntries(files.map(({ path, hash, size }) => [path, { hash, size }]));
  const session = (await call(`/scripts/${name}/assets-upload-session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ manifest }) })) as { jwt: string; buckets?: string[][] };
  let completion = session.jwt;
  for (const bucket of session.buckets ?? []) {
    const form = new FormData();
    // Each file keeps its type, which the origin serves it with: a service worker is refused under any type but JavaScript's.
    for (const hash of bucket) {
      const file = files.find((one) => one.hash === hash)!;
      form.set(hash, new Blob([file.body], { type: TYPES[extname(file.path)] ?? 'application/octet-stream' }), hash);
    }
    const response = await fetch(`${API}/assets/upload?base64=true`, { method: 'POST', headers: { authorization: `Bearer ${session.jwt}` }, body: form });
    const answer = (await response.json()) as { success: boolean; errors: unknown[]; result: { jwt?: string } };
    if (!answer.success) throw new Error(`assets upload: ${JSON.stringify(answer.errors)}`);
    completion = answer.result.jwt ?? completion;
  }
  const form = new FormData();
  form.set('metadata', JSON.stringify({ compatibility_date: '2026-09-01', assets: { jwt: completion } }));
  await call(`/scripts/${name}`, { method: 'PUT', body: form });
  return live(name);
};

