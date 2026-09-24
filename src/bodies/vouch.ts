// SPDX-License-Identifier: Apache-2.0
// A domain's vouch for a ward, as quo/DOMAIN.md writes it: one GET to
// `https://<domain>/.well-known/quo`, never redirected, a status of 200,
// and a body that is one object whose `wards` lists the ward pk. Anything
// else vouches for nothing. Every carry body answers `vouched` through
// this, with the fetch its terrain speaks, so a body written by hand reads
// a vouch as the library's do.
import { privateHost } from '../quo/frame.ts';
import { StrictTools } from './strict-tools.ts';

/** The largest body a vouch may have. */
const LARGEST = 1_048_576;
const WARD = /^[0-9a-f]{128}$/;
const tools = new StrictTools();

/** A GET, as a terrain speaks it. */
export type Fetcher = (url: string, init: { method: 'GET'; redirect: 'error'; signal: AbortSignal }) => Promise<Response>;

// The host of each address whose scheme is one of `schemes`, in their order, each once.
const domainsOf = (at: readonly string[], schemes: readonly string[]): string[] => {
  const hosts: string[] = [];
  for (const address of at) {
    let url: URL;
    try {
      url = new URL(address);
    } catch {
      continue;
    }
    if (!schemes.includes(url.protocol.slice(0, -1).toLowerCase())) continue;
    const host = url.hostname.toLowerCase();
    if (host !== '' && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
};

// Whether one domain's file lists the ward.
const vouches = async (fetcher: Fetcher, domain: string, ward: string, wait: number): Promise<boolean> => {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), wait);
  try {
    const response = await fetcher(`https://${domain}/.well-known/quo`, { method: 'GET', redirect: 'error', signal: abort.signal });
    if (response.status !== 200) return false;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > LARGEST) return false;
    const text = tools.text(bytes);
    const parsed = text === null ? null : tools.parse(text);
    // Two own keys of one name make no vouch, as they make no payload.
    if (parsed === null || parsed.duplicate) return false;
    const value = parsed.value as { wards?: unknown } | null;
    if (value === null || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.wards)) return false;
    return value.wards.some((item) => typeof item === 'string' && WARD.test(item) && item === ward);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * The domains that vouch for `ward`: the host of each address in `at`
 * whose scheme is one of `schemes`, in their order, asked through
 * `fetcher`. A private or loopback host is asked only where
 * `allowPrivate` is set, as a carry dials one.
 */
export const vouchesOf = async ({
  fetcher,
  ward,
  at,
  schemes,
  allowPrivate = false,
  wait = 30_000,
}: {
  fetcher: Fetcher;
  ward: string;
  at: readonly string[];
  schemes: readonly string[];
  allowPrivate?: boolean;
  wait?: number;
}): Promise<string[]> => {
  const asked = domainsOf(at, schemes).filter((domain) => allowPrivate || !privateHost(domain));
  const found = await Promise.all(asked.map((domain) => vouches(fetcher, domain, ward, wait)));
  return asked.filter((_, index) => found[index]);
};
