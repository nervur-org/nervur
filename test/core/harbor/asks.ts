// SPDX-License-Identifier: Apache-2.0
// The root line as the core's suites read it: a harbor is asked by
// `harbor.ask` alone, as whoever holds one asks it.
import type { Harbor, JsonObject } from '../kit.ts';

// What the ward answered, or the root line's silence, word or error.
export const root = async (harbor: Harbor, method?: string, args?: JsonObject, ward?: string): Promise<JsonObject> => {
  const out = await harbor.ask({ ...(ward === undefined ? {} : { ward }), ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }) });
  return 'answer' in out ? (out.answer as JsonObject) : out;
};

// What a being answered, asked as the owner through her ward.
export const being = async (harbor: Harbor, key: string, method?: string, args?: JsonObject, ward?: string): Promise<unknown> => {
  const out = await root(harbor, 'ask', { being: key, ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }) }, ward);
  return 'answer' in out ? out.answer : out;
};

// A ward's census: its pk, its class, and its beings, and the dock's what
// did not stand and where the carriers listen.
export type Census = {
  pk: string;
  class: string;
  beings: Record<string, { class: string; registry?: string; public: boolean; absent: boolean }>;
  wards?: Record<string, { memory?: string; registry?: string }>;
  routes?: Record<string, string[]>;
  reach?: string[];
  failed?: { wards: Record<string, string>; routes: Record<string, string> };
  listening?: string[];
  foreground?: true;
};
export const census = async (harbor: Harbor, ward?: string): Promise<Census> => (await root(harbor, undefined, undefined, ward)).notes as unknown as Census;

// A module's source, added to the harbor's catalogue.
export const add = async (harbor: Harbor, source: string): Promise<unknown> => being(harbor, 'catalogue', 'add', { source });
