// SPDX-License-Identifier: Apache-2.0
// Quo over TCP as a carrier faculty. It dials every `tcp://` address the
// harbor routes, and listens where its cells say, handing what it hears to
// its ground, on the sockets its terrain hands it:
//
//   listen  { host?, port? }   listen there from now on, 127.0.0.1 and a
//                              free port unless named, and on every wake
//                              at the port it bound
//   deaf                       listen nowhere from now on
import { ships, type AskSpec, type JsonObject, type Stance } from '../../core/being/index.ts';
import { CarrierFaculty, groundOf, type Dialed, type Sockets, type TcpListening } from '../../core/harbor/index.ts';
import { tcpAddress } from '../../core/quo/index.ts';
import { ownerAsk } from '../../core/ward/index.ts';

type Listen = { host: string; port: number };
const listenOf = (value: unknown): Listen | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { host, port } = value as Record<string, unknown>;
  return typeof host === 'string' && Number.isInteger(port) && (port as number) >= 0 && (port as number) <= 65_535 ? { host, port: port as number } : null;
};

export class TcpFaculty extends CarrierFaculty {
  static override readonly kind: string = 'org.nervur.tcp';
  static override readonly carries: string = 'tcp';
  static {
    ships(this);
  }
  static override asks: Record<string, AskSpec> = {
    listen: ownerAsk('listen for Quo over TCP, and on every wake', { properties: { host: { type: 'string' }, port: { type: 'integer' } } }),
    deaf: ownerAsk('listen nowhere'),
  };

  readonly #sockets: Sockets;
  #listener: TcpListening | undefined;

  // A ground with no sockets speaks no TCP, and no TCP faculty stands on it.
  constructor(stance: Stance) {
    super(stance);
    const sockets = groundOf(stance).terrain.tcp;
    if (!sockets) throw new Error('this ground speaks no TCP');
    this.#sockets = sockets();
  }

  accepts(address: string): boolean {
    return tcpAddress(address) !== null;
  }

  dial(address: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    return this.#sockets.dial(address, pk, bytes);
  }

  override listening(): string[] {
    return this.#listener ? [this.#listener.at] : [];
  }

  override async awake(): Promise<void> {
    const at = listenOf(this.cells.listen);
    if (at && !this.#listener) this.#listener = await this.#sockets.listen(groundOf(this.stance), at.host, at.port);
  }

  override async sleep(): Promise<void> {
    await this.#sockets.close();
    await this.#listener?.close();
    this.#listener = undefined;
  }

  async listen(args: JsonObject): Promise<JsonObject> {
    const at = listenOf({ host: args.host ?? '127.0.0.1', port: args.port ?? 0 });
    if (at === null) return { error: 'host is text and port a port' };
    await this.#listener?.close();
    this.#listener = undefined;
    try {
      this.#listener = await this.#sockets.listen(groundOf(this.stance), at.host, at.port);
    } catch (e) {
      return { error: (e as Error).message };
    }
    // The port it bound, so a wake listens where every route and every
    // invitation already points.
    this.cells.listen = { host: at.host, port: tcpAddress(this.#listener.at)!.port };
    return { at: this.#listener.at };
  }

  async deaf(): Promise<JsonObject> {
    await this.#listener?.close();
    this.#listener = undefined;
    delete this.cells.listen;
    return { deaf: true };
  }
}
