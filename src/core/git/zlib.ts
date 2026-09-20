// SPDX-License-Identifier: Apache-2.0
// zlib, as git keeps an object. A loose object is deflated and inflated by
// the engine's own CompressionStream and DecompressionStream. A pack holds
// its objects one after another with no length before each stream, and a
// stream API never says how much of its input one stream took, so a pack
// is read by `inflateAt`, an inflater of RFC 1950 and 1951 that says where
// the stream it read ends.
import { own } from '../crypto/subtle.ts';

const through = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> => {
  const writer = stream.writable.getWriter();
  void writer.write(own(bytes)).catch(() => undefined);
  void writer.close().catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
};

export const deflate = (bytes: Uint8Array): Promise<Uint8Array> => through(bytes, new CompressionStream('deflate'));

export const inflate = async (bytes: Uint8Array): Promise<Uint8Array> => {
  try {
    return await through(bytes, new DecompressionStream('deflate'));
  } catch {
    throw new Error('bytes that do not inflate');
  }
};

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const BITS = 15;

// A canonical Huffman code, by how many codes each length has and the
// symbols in code order.
type Huffman = { count: Uint16Array; symbol: Uint16Array };

const huffman = (lengths: ArrayLike<number>): Huffman => {
  const count = new Uint16Array(BITS + 1);
  for (let s = 0; s < lengths.length; s += 1) count[lengths[s]!]! += 1;
  const offsets = new Uint16Array(BITS + 1);
  for (let len = 1; len < BITS; len += 1) offsets[len + 1] = offsets[len]! + count[len]!;
  const symbol = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s += 1) if (lengths[s] !== 0) symbol[offsets[lengths[s]!]!++] = s;
  count[0] = 0;
  return { count, symbol };
};

const FIXED_LENGTHS = huffman(Array.from({ length: 288 }, (_, s) => (s < 144 ? 8 : s < 256 ? 9 : s < 280 ? 7 : 8)));
const FIXED_DISTANCES = huffman(Array.from({ length: 30 }, () => 5));

class Reader {
  readonly #bytes: Uint8Array;
  at: number;
  #buffer = 0;
  #held = 0;
  constructor(bytes: Uint8Array, at: number) {
    this.#bytes = bytes;
    this.at = at;
  }
  bits(n: number): number {
    while (this.#held < n) {
      if (this.at >= this.#bytes.length) throw new Error('a stream cut short');
      this.#buffer |= this.#bytes[this.at++]! << this.#held;
      this.#held += 8;
    }
    const out = this.#buffer & ((1 << n) - 1);
    this.#buffer >>>= n;
    this.#held -= n;
    return out;
  }
  // The rest of this byte let go, as a stored block and the end ask.
  align(): void {
    this.#buffer = 0;
    this.#held = 0;
  }
  byte(): number {
    if (this.at >= this.#bytes.length) throw new Error('a stream cut short');
    return this.#bytes[this.at++]!;
  }
  decode(h: Huffman): number {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= BITS; len += 1) {
      code |= this.bits(1);
      const count = h.count[len]!;
      if (code - count < first) return h.symbol[index + (code - first)]!;
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('a code no table holds');
  }
}

class Output {
  bytes = new Uint8Array(1024);
  length = 0;
  #room(n: number): void {
    if (this.length + n <= this.bytes.length) return;
    let size = this.bytes.length * 2;
    while (size < this.length + n) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.bytes.subarray(0, this.length));
    this.bytes = grown;
  }
  push(byte: number): void {
    this.#room(1);
    this.bytes[this.length++] = byte;
  }
  copy(distance: number, length: number): void {
    if (distance > this.length) throw new Error('a distance before the start');
    this.#room(length);
    for (let k = 0; k < length; k += 1) this.bytes[this.length] = this.bytes[this.length++ - distance]!;
  }
}

const dynamic = (r: Reader): [Huffman, Huffman] => {
  const nlen = r.bits(5) + 257;
  const ndist = r.bits(5) + 1;
  const ncode = r.bits(4) + 4;
  const codeLengths = new Uint8Array(19);
  for (let k = 0; k < ncode; k += 1) codeLengths[ORDER[k]!] = r.bits(3);
  const codes = huffman(codeLengths);
  const lengths = new Uint8Array(nlen + ndist);
  for (let k = 0; k < nlen + ndist; ) {
    const sym = r.decode(codes);
    if (sym < 16) {
      lengths[k++] = sym;
      continue;
    }
    let repeat: number;
    let value = 0;
    if (sym === 16) {
      if (k === 0) throw new Error('a repeat with nothing before it');
      value = lengths[k - 1]!;
      repeat = 3 + r.bits(2);
    } else if (sym === 17) repeat = 3 + r.bits(3);
    else repeat = 11 + r.bits(7);
    if (k + repeat > nlen + ndist) throw new Error('too many lengths');
    while (repeat-- > 0) lengths[k++] = value;
  }
  return [huffman(lengths.subarray(0, nlen)), huffman(lengths.subarray(nlen))];
};

const adler32 = (bytes: Uint8Array): number => {
  let a = 1;
  let b = 0;
  for (let k = 0; k < bytes.length; k += 1) {
    a = (a + bytes[k]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

// One zlib stream that starts at `at`: its bytes, and where it ends.
export const inflateAt = (bytes: Uint8Array, at: number): { out: Uint8Array; end: number } => {
  const r = new Reader(bytes, at);
  const cmf = r.byte();
  const flg = r.byte();
  if ((cmf & 15) !== 8 || ((cmf << 8) | flg) % 31 !== 0 || (flg & 32) !== 0) throw new Error('no zlib stream');
  const out = new Output();
  for (let last = 0; last === 0; ) {
    last = r.bits(1);
    const type = r.bits(2);
    if (type === 0) {
      r.align();
      const len = r.byte() | (r.byte() << 8);
      const nlen = r.byte() | (r.byte() << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error('a stored block whose length does not check');
      for (let k = 0; k < len; k += 1) out.push(r.byte());
      continue;
    }
    if (type === 3) throw new Error('a block of no type');
    const [lengths, distances] = type === 1 ? [FIXED_LENGTHS, FIXED_DISTANCES] : dynamic(r);
    for (;;) {
      const sym = r.decode(lengths);
      if (sym < 256) out.push(sym);
      else if (sym === 256) break;
      else {
        const l = sym - 257;
        if (l >= 29) throw new Error('a length of no code');
        const length = LENGTH_BASE[l]! + r.bits(LENGTH_EXTRA[l]!);
        const d = r.decode(distances);
        if (d >= 30) throw new Error('a distance of no code');
        out.copy(DISTANCE_BASE[d]! + r.bits(DISTANCE_EXTRA[d]!), length);
      }
    }
  }
  r.align();
  const sum = ((r.byte() << 24) | (r.byte() << 16) | (r.byte() << 8) | r.byte()) >>> 0;
  const result = out.bytes.slice(0, out.length);
  if (sum !== adler32(result)) throw new Error('a stream whose sum does not check');
  return { out: result, end: r.at };
};
