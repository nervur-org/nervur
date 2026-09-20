// SPDX-License-Identifier: Apache-2.0
// The root line's request: plain JSON, for whatever carries the root's
// asks to a harbor in its own process. The command carries it over a local
// socket, and a browser worker from its tabs. `Harbor.ask` answers it.
//
//   request  { ward?, method?, args? }    no ward is the box ward, no
//                                         method the census
import type { JsonObject } from '../being/index.ts';

export type RootRequest = { ward?: string; method?: string; args?: JsonObject };

const object = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

export const readRootRequest = (value: unknown): RootRequest | null => {
  if (!object(value)) return null;
  const { ward, method, args } = value;
  if ((ward !== undefined && typeof ward !== 'string') || (method !== undefined && typeof method !== 'string') || (args !== undefined && !object(args))) return null;
  return { ...(ward === undefined ? {} : { ward }), ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }) };
};
