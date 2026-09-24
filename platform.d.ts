// SPDX-License-Identifier: Apache-2.0
// The web platform `nervur` takes, beyond ECMAScript, and nothing more.
// Every engine a ground runs on gives these: Node, Deno, Bun, a worker,
// a page. Only `tsconfig.pure.json` reads this file; it proves the
// entries reach for nothing else.

declare class TextEncoder {
  encode(input?: string): Uint8Array<ArrayBuffer>;
}

declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
  decode(input?: Uint8Array): string;
}

declare function setTimeout(handler: () => void, ms?: number): unknown;
declare function clearTimeout(timer: unknown): void;

interface PlatformKey {
  readonly type: string;
}

interface PlatformSubtle {
  digest(algorithm: string, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer>;
  importKey(format: 'raw', key: Uint8Array<ArrayBuffer>, algorithm: string, extractable: boolean, usages: string[]): Promise<PlatformKey>;
  deriveBits(algorithm: { name: string; hash: string; salt: Uint8Array; info: Uint8Array }, key: PlatformKey, length: number): Promise<ArrayBuffer>;
  encrypt(algorithm: { name: string; iv: Uint8Array<ArrayBuffer>; additionalData: Uint8Array<ArrayBuffer> }, key: PlatformKey, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer>;
  decrypt(algorithm: { name: string; iv: Uint8Array<ArrayBuffer>; additionalData: Uint8Array<ArrayBuffer> }, key: PlatformKey, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer>;
}

// The fetch standard, as `WebCarry` and every handler speak it.
declare class Headers {
  constructor(init?: Record<string, string>);
  get(name: string): string | null;
}

interface PlatformBody {
  cancel(): Promise<void>;
}

declare class Request {
  constructor(input: string, init?: { method?: string; headers?: Record<string, string>; body?: Uint8Array | null });
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  arrayBuffer(): Promise<ArrayBuffer>;
}

declare class Response {
  constructor(body?: Uint8Array | string | null, init?: { status?: number; headers?: Record<string, string> });
  readonly status: number;
  readonly headers: Headers;
  readonly body: PlatformBody | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

declare class URL {
  constructor(url: string, base?: string);
  readonly protocol: string;
  readonly hostname: string;
  readonly pathname: string;
}

interface AbortSignal {
  readonly aborted: boolean;
}

declare class AbortController {
  readonly signal: AbortSignal;
  abort(): void;
}

declare function fetch(input: string, init?: { method?: string; body?: Uint8Array; signal?: AbortSignal }): Promise<Response>;

declare class WebSocket {
  constructor(url: string, protocols?: string | string[]);
  binaryType: 'blob' | 'arraybuffer';
  readonly protocol: string;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: Uint8Array): void;
  close(): void;
}

declare var crypto: {
  getRandomValues<T extends Uint8Array>(array: T): T;
  readonly subtle: PlatformSubtle;
};
