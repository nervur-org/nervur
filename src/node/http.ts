// SPDX-License-Identifier: Apache-2.0
// One HTTP listener for a ground, chaining its handlers: each request goes
// to the first handler that answers it, and each WebSocket to the first
// that takes it. `WebCarry` is one handler, and every face is another, so
// a ground holds one port whatever speaks HTTP on it.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Socket } from 'node:net';
import type { Handler } from '../bodies/web-carry.ts';
import { acceptOf, hold } from './websocket.ts';

/** The longest request body a handler is handed, and the longest WebSocket message. */
const LONGEST = 8 * 1024 * 1024;

export interface Served {
  /** The port it listens on. */
  readonly port: number;
  close(): Promise<void>;
}

const requestOf = (message: IncomingMessage, body: Buffer | null): Request => {
  const headers = new Headers();
  for (let index = 0; index + 1 < message.rawHeaders.length; index += 2) headers.append(message.rawHeaders[index], message.rawHeaders[index + 1]);
  const url = `http://${message.headers.host ?? 'localhost'}${message.url ?? '/'}`;
  return new Request(url, { method: message.method ?? 'GET', headers, ...(body === null ? {} : { body: new Uint8Array(body) }) });
};

const read = (message: IncomingMessage): Promise<Buffer | null> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let length = 0;
    message.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > LONGEST) {
        resolve(null);
        message.destroy();
        return;
      }
      chunks.push(chunk);
    });
    message.on('end', () => resolve(Buffer.concat(chunks)));
    message.on('error', () => resolve(null));
  });

/** Listens on `port`, `0` for one the system picks, and hands every request to `handlers` in order. */
export const serveHttp = async ({ port = 0, host = '0.0.0.0' }: { port?: number; host?: string }, handlers: readonly Handler[]): Promise<Served> => {
  const sockets = new Set<Socket>();
  const server: Server = createServer(async (message, response) => {
    try {
      const bodied = message.method !== 'GET' && message.method !== 'HEAD';
      const body = bodied ? await read(message) : null;
      if (bodied && body === null) {
        response.writeHead(413).end();
        return;
      }
      const request = requestOf(message, body);
      for (const handler of handlers) {
        const answered = await handler.fetch(request);
        if (answered === null) continue;
        response.writeHead(answered.status, Object.fromEntries(answered.headers));
        response.end(Buffer.from(await answered.arrayBuffer()));
        return;
      }
      response.writeHead(404).end();
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('upgrade', (message: IncomingMessage, socket: Socket, head: Buffer) => {
    const key = message.headers['sec-websocket-key'];
    const request = requestOf(message, null);
    const taken = typeof key === 'string' && message.headers['sec-websocket-version'] === '13' ? handlers.map((handler) => handler.upgrade?.(request) ?? null).find((one) => one !== null) : undefined;
    if (taken === undefined || typeof key !== 'string') {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return;
    }
    socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptOf(key)}`, `Sec-WebSocket-Protocol: ${taken.protocol}`, '', ''].join('\r\n'));
    hold(socket, taken.open, LONGEST);
    if (head.length > 0) socket.unshift(head);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  return {
    port: typeof address === 'object' && address !== null ? address.port : port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};
