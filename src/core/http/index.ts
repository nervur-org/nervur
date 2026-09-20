// SPDX-License-Identifier: Apache-2.0
// `nervur/http`: the web carrier's listener on Node's HTTP server, an entry
// that names a platform.
//
//   webServe   answers posts at a path, and held lines opened to that path
//              with the subprotocol `quo`, for the ground it is handed:
//              the body a Node terrain hands the web carrier
//
// A post is one ask: 200 with the reply's box, or 204 for nothing. A post
// to another path is 404, another method 405, a body that is no ask 400.
// A page of an origin the cells name, or of any origin under `*`, is
// answered as the CORS protocol says, its preflight included. A held line
// carries one frame body to a binary message; a text message, a body that
// is no frame, or bytes that break RFC 6455 close it, and nothing after
// them is read.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { Arrivals as Ground, WebListen, WebListener, WebServe } from '../harbor/index.ts';
import { MAX_BODY, MAX_POST, nothingBody, readBody, readPost, replyBody } from '../line/index.ts';
import { hex } from '../crypto/index.ts';
import { tcpAt } from '../quo/index.ts';
import { acceptKey, frameOf, isClientKey, OP, WsReader } from './websocket.ts';

const pathOf = (url: string | undefined): string => {
  const at = (url ?? '/').indexOf('?');
  return at < 0 ? (url ?? '/') : (url ?? '/').slice(0, at);
};

const originOf = (origins: readonly string[], origin: string | undefined): string | null => {
  if (origin === undefined) return null;
  if (origins.includes('*')) return '*';
  return origins.includes(origin) ? origin : null;
};

// The bytes of a request, up to one more than `max`, as they came.
const bodyOf = (request: IncomingMessage, max: number): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const parts: Uint8Array[] = [];
    let length = 0;
    request.on('data', (chunk: Uint8Array) => {
      if (length > max) return;
      parts.push(chunk);
      length += chunk.length;
    });
    request.on('end', () => {
      const out = new Uint8Array(length);
      let at = 0;
      for (const part of parts) {
        out.set(part, at);
        at += part.length;
      }
      resolve(out);
    });
    request.on('error', reject);
  });

const post = async (ground: Ground, listen: WebListen, request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const allowed = originOf(listen.origins, request.headers.origin);
  if (allowed !== null) response.setHeader('access-control-allow-origin', allowed);
  if (pathOf(request.url) !== listen.path) return void response.writeHead(404).end();
  if (request.method === 'OPTIONS') {
    if (allowed !== null) {
      response.setHeader('access-control-allow-methods', 'POST');
      response.setHeader('access-control-allow-headers', 'content-type');
    }
    return void response.writeHead(204).end();
  }
  if (request.method !== 'POST') return void response.writeHead(405, { allow: 'POST, OPTIONS' }).end();
  const ask = readPost(await bodyOf(request, MAX_POST));
  if (ask === null) return void response.writeHead(400).end();
  let reply: Uint8Array | null = null;
  try {
    reply = await ground.arrive(ask.pk, ask.box);
  } catch {
    reply = null;
  }
  if (reply === null || reply.length === 0) return void response.writeHead(204).end();
  response.writeHead(200, { 'content-type': 'application/octet-stream' }).end(reply);
};

const upgrade = (ground: Ground, listen: WebListen, request: IncomingMessage, socket: Socket): void => {
  const key = request.headers['sec-websocket-key'];
  const offered = String(request.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((p) => p.trim());
  const fine = pathOf(request.url) === listen.path && request.headers['sec-websocket-version'] === '13' && isClientKey(key) && offered.includes('quo');
  if (!fine) {
    socket.end('HTTP/1.1 400 Bad Request\r\nconnection: close\r\ncontent-length: 0\r\n\r\n');
    return;
  }
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-accept: ${acceptKey(key)}\r\nsec-websocket-protocol: quo\r\n\r\n`);
  const reader = new WsReader(MAX_BODY);
  const send = (opcode: number, payload?: Uint8Array): void => {
    if (!socket.destroyed) socket.write(frameOf(opcode, payload));
  };
  const close = (): void => {
    send(OP.close);
    socket.end();
  };
  socket.on('data', (chunk: Uint8Array) => {
    for (const event of reader.push(chunk)) {
      if (event.type === 'ping') send(OP.pong, event.data);
      else if (event.type !== 'binary') return close();
      else {
        const frame = readBody(event.data);
        if (frame === null) return close();
        if (frame.kind !== 'ask') continue;
        void ground
          .arrive(hex(frame.pk), frame.box)
          .catch(() => null)
          .then((reply) => send(OP.binary, reply === null ? nothingBody(frame.id) : replyBody(frame.id, reply)));
      }
    }
  });
  socket.on('error', () => socket.destroy());
};

// A listener of the web carrier for one ground.
export const webServe: WebServe = (ground: Ground, listen: WebListen): Promise<WebListener> => {
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    void post(ground, listen, request, response).catch(() => {
      if (!response.headersSent) response.writeHead(400);
      response.end();
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('upgrade', (request: IncomingMessage, socket: Socket) => upgrade(ground, listen, request, socket));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(listen.port, listen.host, () => {
      const { address, port } = server.address() as { address: string; port: number };
      const authority = tcpAt(address, port).slice('tcp://'.length);
      resolve({
        port,
        at: [`http://${authority}${listen.path}`, `ws://${authority}${listen.path}`],
        close: () => {
          for (const socket of sockets) socket.destroy();
          return new Promise((done) => server.close(() => done()));
        },
      });
    });
  });
};
