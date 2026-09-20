// SPDX-License-Identifier: Apache-2.0
// The web carrier's inbound side on the standard Request and Response,
// for a ground whose engine hands its code a request: a post answered, and
// a held line's messages, whatever socket the engine gives.
//
// A post is one ask: 200 with the reply's box, or 204 for nothing. A post
// to another path is 404, another method 405, a body that is no ask 400.
// A page of an origin the listen names, or of any under `*`, is answered
// as the CORS protocol says, its preflight included.
import { hex } from '../crypto/index.ts';
import type { Arrivals as Ground } from '../harbor/index.ts';
import { nothingBody, readBody, replyBody } from './frame.ts';
import type { WebListen } from '../harbor/index.ts';
import { MAX_POST, readPost } from './web.ts';

const allowedOrigin = (origins: readonly string[], origin: string | null): string | null => {
  if (origin === null) return null;
  if (origins.includes('*')) return '*';
  return origins.includes(origin) ? origin : null;
};

export const answerPost = async (ground: Ground, listen: WebListen, request: Request): Promise<Response> => {
  const headers = new Headers();
  const allowed = allowedOrigin(listen.origins, request.headers.get('origin'));
  if (allowed !== null) headers.set('access-control-allow-origin', allowed);
  if (new URL(request.url).pathname !== listen.path) return new Response(null, { status: 404, headers });
  if (request.method === 'OPTIONS') {
    if (allowed !== null) {
      headers.set('access-control-allow-methods', 'POST');
      headers.set('access-control-allow-headers', 'content-type');
    }
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') {
    headers.set('allow', 'POST, OPTIONS');
    return new Response(null, { status: 405, headers });
  }
  const body = new Uint8Array(await request.arrayBuffer());
  const ask = body.length > MAX_POST ? null : readPost(body);
  if (ask === null) return new Response(null, { status: 400, headers });
  const reply = await ground.arrive(ask.pk, ask.box).catch(() => null);
  if (reply === null || reply.length === 0) return new Response(null, { status: 204, headers });
  headers.set('content-type', 'application/octet-stream');
  return new Response(new Uint8Array(reply), { status: 200, headers });
};

// What a held line answers with: a binary message back, or the line closed.
export type HeldSide = { send(body: Uint8Array): void; close(): void };

// One message on a held line: an ask answered on the same line, a text
// message or a body that is no frame closing it, and anything else let be.
export const answerHeld = (ground: Ground, side: HeldSide, message: Uint8Array | string): void => {
  const frame = typeof message === 'string' ? null : readBody(message);
  if (frame === null) return side.close();
  if (frame.kind !== 'ask') return;
  void ground
    .arrive(hex(frame.pk), frame.box)
    .catch(() => null)
    .then((reply) => side.send(reply === null ? nothingBody(frame.id) : replyBody(frame.id, reply)));
};
