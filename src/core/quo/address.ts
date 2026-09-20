// SPDX-License-Identifier: Apache-2.0
// Addresses, as `SPEC.md` names them in an invitation's `at`: a URI of
// RFC 3986 whose scheme, read in any case, names a carrier.
// `CARRIER-TCP.md` writes `tcp://host:port`, and `CARRIER-WEB.md` writes
// `http` and `https` for the post and `ws` and `wss` for the held line.

// RFC 3986 appendix B, with the characters a URI may hold checked apart.
const SPLIT = /^(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;
const URI_CHARS = /^(?:[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=]|%[0-9A-Fa-f]{2})*$/;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const REG_NAME = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=]|%[0-9A-Fa-f]{2})*$/;
const IP_LITERAL = /^\[(?:[0-9A-Fa-f:.]+|v[0-9A-Fa-f]+\.[A-Za-z0-9\-._~!$&'()*+,;=:]+)\]$/;

type Parts = { scheme: string; authority: string | null; userinfo: string | null; host: string | null; port: string | null; path: string; query: string | null; fragment: string | null };

// A URI with a scheme, taken apart, or null. `host` is as written,
// brackets included, and `port` the digits as written.
const parse = (s: unknown): Parts | null => {
  if (typeof s !== 'string' || !URI_CHARS.test(s)) return null;
  const m = SPLIT.exec(s);
  if (!m || m[1] === undefined || !SCHEME.test(m[1])) return null;
  const out: Parts = { scheme: m[1].toLowerCase(), authority: m[2] ?? null, userinfo: null, host: null, port: null, path: m[3] ?? '', query: m[4] ?? null, fragment: m[5] ?? null };
  if (out.authority === null) return out;
  let rest = out.authority;
  const at = rest.lastIndexOf('@');
  if (at >= 0) {
    out.userinfo = rest.slice(0, at);
    rest = rest.slice(at + 1);
  }
  const hp = /^(\[[^\]]*\]|[^:[\]]*)(?::([0-9]*))?$/.exec(rest);
  if (!hp) return null;
  const host = hp[1]!;
  if (host.startsWith('[') ? !IP_LITERAL.test(host) : !REG_NAME.test(host)) return null;
  out.host = host;
  out.port = hp[2] ?? null;
  return out;
};

// The host as a socket takes it: an IPv6 literal without its brackets.
const bare = (host: string): string => (host.startsWith('[') ? host.slice(1, -1) : host);

// The scheme an address names, lowercase, or null for what is no URI.
export const schemeOf = (s: unknown): string | null => parse(s)?.scheme ?? null;

export type TcpAddress = { host: string; port: number };

// A `tcp` address as `CARRIER-TCP.md` writes one, or null.
export const tcpAddress = (s: unknown): TcpAddress | null => {
  const a = parse(s);
  if (!a || a.scheme !== 'tcp' || a.authority === null) return null;
  if (a.userinfo !== null || a.path !== '' || a.query !== null || a.fragment !== null) return null;
  if (!a.host || a.port === null || !/^[0-9]+$/.test(a.port)) return null;
  const port = Number(a.port);
  if (port < 1 || port > 65_535) return null;
  return { host: bare(a.host), port };
};

// The `tcp` address of a host and port.
export const tcpAt = (host: string, port: number): string => `tcp://${host.includes(':') ? `[${host}]` : host}:${port}`;

export type WebAddress = { scheme: 'http' | 'https' | 'ws' | 'wss'; secure: boolean; held: boolean; host: string; port: number; path: string; href: string };
const WEB = new Set(['http', 'https', 'ws', 'wss']);

// An address of `CARRIER-WEB.md`, or null. `path` is the path and query
// a request names, `/` when both are empty.
export const webAddress = (s: unknown): WebAddress | null => {
  const a = parse(s);
  if (!a || !WEB.has(a.scheme) || a.authority === null) return null;
  if (a.userinfo !== null || a.fragment !== null || !a.host) return null;
  if (a.port !== null && a.port !== '' && (!/^[0-9]+$/.test(a.port) || Number(a.port) > 65_535)) return null;
  const scheme = a.scheme as WebAddress['scheme'];
  const secure = scheme === 'https' || scheme === 'wss';
  const port = a.port ? Number(a.port) : secure ? 443 : 80;
  const path = `${a.path || '/'}${a.query !== null ? `?${a.query}` : ''}`;
  return { scheme, secure, held: scheme === 'ws' || scheme === 'wss', host: bare(a.host), port, path, href: s as string };
};

// Whether a tcp or web address names the unspecified host, where a
// listener binds every interface and no caller can dial.
export const unspecified = (s: unknown): boolean => {
  const host = (tcpAddress(s) ?? webAddress(s))?.host;
  return host === '0.0.0.0' || host === '::';
};

// An invitation's `at` as `SPEC.md` reads it: the strings that are URIs
// with a scheme, in their order. A value that is no array is absent.
export const readAt = (value: unknown): string[] => (Array.isArray(value) ? value.filter((s): s is string => parse(s) !== null) : []);
