// Values as they cross between the test and the worker as JSON: bytes as
// `{ $hex }`, everything else as it is. Both sides read this one file.

export type Wire = null | boolean | number | string | { readonly $hex: string } | readonly Wire[] | { readonly [key: string]: Wire };

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const unhex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

export const toWire = (value: unknown): Wire => {
  if (value instanceof Uint8Array) return { $hex: hex(value) };
  if (Array.isArray(value)) return value.map(toWire);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, toWire(inner)]));
  return (value ?? null) as Wire;
};

export const fromWire = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(fromWire);
  if (typeof value === 'object' && value !== null) {
    if ('$hex' in value && typeof value.$hex === 'string') return unhex(value.$hex);
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, fromWire(inner)]));
  }
  return value;
};
