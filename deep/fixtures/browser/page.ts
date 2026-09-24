// The page the browser's own run loads. It opens a BrowserGround on the
// origin's real IndexedDB and Web Locks, and lends its memory body to the
// run, which drives both from outside through `window.nervur`. Bytes cross
// as hex, since the run and the page share nothing but JSON.
import { BrowserGround, IndexedDbMemory } from 'nervur/browser';

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const bytes = (text: string) => new Uint8Array(text.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);
const inward = (writes: Record<string, Record<string, string | null>>) =>
  Object.fromEntries(Object.entries(writes).map(([place, entries]) => [place, Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, value === null ? null : bytes(value)]))]));

const memories = new Map<string, IndexedDbMemory>();
let ground: BrowserGround | undefined;

const nervur = {
  async open(name: string) {
    ground = await BrowserGround.open({ name, allowPrivate: true });
  },
  led: () => ground!.led(),
  close: () => ground!.close(),
  // What the service worker says it heard, the next time it speaks.
  heard: (name: string) =>
    new Promise((resolve) => {
      const channel = new BroadcastChannel(`${name}-heard`);
      channel.onmessage = (event) => {
        channel.close();
        resolve(event.data);
      };
    }),
  register: async () => {
    await navigator.serviceWorker.register('/sw.js', { type: 'module' });
    await navigator.serviceWorker.ready;
  },
  leading: () => ground!.leading,
  hand: (request: Parameters<BrowserGround['hand']>[0]) => ground!.hand(request),
  async memory(name: string, op: 'read' | 'list' | 'write', args: { place?: string; writes?: Record<string, Record<string, string | null>>; expect?: Record<string, string | null> }) {
    if (!memories.has(name)) memories.set(name, await IndexedDbMemory.open(name));
    const memory = memories.get(name)!;
    if (op === 'list') return memory.list();
    if (op === 'read') {
      const read = await memory.read({ place: args.place! });
      return { entries: Object.fromEntries(Object.entries(read.entries).map(([entry, value]) => [entry, hex(value)])), version: read.version };
    }
    return memory.write({ writes: inward(args.writes!), expect: args.expect! });
  },
};

Object.assign(globalThis, { nervur });
