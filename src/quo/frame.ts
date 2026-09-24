// SPDX-License-Identifier: Apache-2.0
// A frame's body, as quo/CARRIER-TCP.md writes it: kind, id and rest. Over
// TCP a length goes in front; on a held line the message is the body.
// And which hosts a carry refuses to dial unless its ground allows it.

export const ASK = 0;
export const REPLY = 1;
export const NOTHING = 2;
/** The longest frame body. */
export const LARGEST = 1_048_645;
/** A ward pk, in bytes. */
export const PK = 64;

export interface Frame {
  readonly kind: number;
  readonly id: number;
  readonly rest: Uint8Array;
}

/** A frame's body. */
export const body = (kind: number, id: number, rest: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(5 + rest.length);
  out[0] = kind;
  new DataView(out.buffer).setUint32(1, id >>> 0);
  out.set(rest, 5);
  return out;
};

/** A frame read from its body, or `null` where the body is no frame and its connection closes. */
export const read = (bytes: Uint8Array): Frame | null => {
  if (bytes.length < 5 || bytes.length > LARGEST) return null;
  const kind = bytes[0];
  const rest = bytes.slice(5);
  if (kind > NOTHING || (kind === ASK && rest.length < PK) || (kind === NOTHING && rest.length > 0)) return null;
  return { kind, id: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1), rest };
};

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Whether an IP address is loopback, private, shared, link-local or unspecified. */
export const privateAddress = (ip: string): boolean => {
  const four = IPV4.exec(ip);
  if (four !== null) {
    const [a, b] = [Number(four[1]), Number(four[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) return privateAddress(lower.slice(7));
  return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
};

/** Whether a host, as a URL writes it, is one a carry dials only where its ground allows. */
export const privateHost = (host: string): boolean => {
  const bare = host.startsWith('[') ? host.slice(1, -1) : host;
  const lower = bare.toLowerCase();
  return lower === 'localhost' || lower.endsWith('.localhost') || privateAddress(lower);
};
