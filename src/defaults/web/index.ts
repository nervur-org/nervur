// SPDX-License-Identifier: Apache-2.0
// Quo over the web as a carrier faculty. It dials every `http`, `https`,
// `ws` and `wss` address the harbor routes, on fetch and the WebSocket
// client, and listens where its cells say through the listener its
// terrain runs, where the terrain runs one:
//
//   listen  { host?, port?, path?, origins? }
//                  listen there from now on, 127.0.0.1, a free port, `/`
//                  and every origin unless named, and on every wake at the
//                  port it bound
//   deaf           listen nowhere from now on
import { ships, type AskSpec, type JsonObject } from '../../core/being/index.ts';
import { CarrierFaculty, groundOf, type Dialed, type Ground, type WebListen, type WebListener } from '../../core/harbor/index.ts';
import { WebDialer } from '../../core/line/index.ts';
import { webAddress } from '../../core/quo/index.ts';
import { ownerAsk } from '../../core/ward/index.ts';

const listenOf = (value: unknown): WebListen | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { host, port, path, origins } = value as Record<string, unknown>;
  const fine =
    typeof host === 'string' &&
    Number.isInteger(port) &&
    (port as number) >= 0 &&
    (port as number) <= 65_535 &&
    typeof path === 'string' &&
    path.startsWith('/') &&
    Array.isArray(origins) &&
    origins.every((o) => typeof o === 'string');
  return fine ? { host, port: port as number, path, origins: origins as string[] } : null;
};

export class WebFaculty extends CarrierFaculty {
  static override readonly kind: string = 'org.nervur.web';
  static override readonly carries: string = 'web';
  static {
    ships(this);
  }
  static override asks: Record<string, AskSpec> = {
    listen: ownerAsk('listen for Quo over the web, and on every wake'),
    deaf: ownerAsk('listen nowhere'),
  };

  readonly #dialer = new WebDialer();
  #listener: WebListener | undefined;

  get #ground(): Ground {
    return groundOf(this.stance);
  }

  accepts(address: string): boolean {
    return webAddress(address) !== null;
  }

  dial(address: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    return this.#dialer.dial(address, pk, bytes);
  }

  override listening(): string[] {
    return this.#listener ? [...this.#listener.at] : [];
  }

  override async awake(): Promise<void> {
    const at = listenOf(this.cells.listen);
    const serve = this.#ground.terrain.web;
    if (at && serve && !this.#listener) this.#listener = await serve(this.#ground, at);
  }

  override async sleep(): Promise<void> {
    await this.#dialer.close();
    await this.#listener?.close();
    this.#listener = undefined;
  }

  async listen(args: JsonObject): Promise<JsonObject> {
    const serve = this.#ground.terrain.web;
    if (!serve) return { error: 'this ground listens nowhere on the web' };
    const at = listenOf({ host: args.host ?? '127.0.0.1', port: args.port ?? 0, path: args.path ?? '/', origins: args.origins ?? ['*'] });
    if (at === null) return { error: 'host is text, port a port, path a path and origins a list' };
    await this.#listener?.close();
    this.#listener = undefined;
    try {
      this.#listener = await serve(this.#ground, at);
    } catch (e) {
      return { error: (e as Error).message };
    }
    this.cells.listen = { ...at, port: this.#listener.port };
    return { at: [...this.#listener.at] };
  }

  async deaf(): Promise<JsonObject> {
    await this.#listener?.close();
    this.#listener = undefined;
    delete this.cells.listen;
    return { deaf: true };
  }
}
