// A Durable Object's storage kept in the process, as the platform gives it
// to one object: values by key, a transaction that runs alone, and one
// alarm, which calls `alarmed` when its time comes, as the platform calls
// the object's `alarm()`. The real one runs on workerd in `deep/edge`.
import type { DurableStorage, DurableTransaction } from 'nervur/edge';

export class MapStorage implements DurableStorage {
  readonly held = new Map<string, unknown>();
  alarmed: () => void = () => undefined;
  #alarm: number | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #turn: Promise<unknown> = Promise.resolve();
  readonly #setting: ((at: number) => void)[] = [];

  async get(key: string): Promise<unknown> {
    return structuredClone(this.held.get(key));
  }

  async put(entries: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) this.held.set(key, structuredClone(value));
  }

  async delete(keys: string[]): Promise<number> {
    return keys.filter((key) => this.held.delete(key)).length;
  }

  async list({ prefix }: { prefix: string }): Promise<Map<string, unknown>> {
    return new Map([...this.held].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)));
  }

  // One transaction at a time, its writes kept aside and landed together when it ends.
  transaction<T>(closure: (transaction: DurableTransaction) => Promise<T>): Promise<T> {
    const run = this.#turn.then(async () => {
      const writes = new Map<string, unknown>();
      const gone = new Set<string>();
      const answer = await closure({
        get: async (key) => (gone.has(key) ? undefined : writes.has(key) ? writes.get(key) : this.get(key)),
        put: async (entries) => {
          for (const [key, value] of Object.entries(entries)) {
            gone.delete(key);
            writes.set(key, structuredClone(value));
          }
        },
        delete: async (keys) => {
          for (const key of keys) {
            writes.delete(key);
            gone.add(key);
          }
          return keys.length;
        },
      });
      for (const key of gone) this.held.delete(key);
      for (const [key, value] of writes) this.held.set(key, value);
      return answer;
    });
    this.#turn = run.catch(() => undefined);
    return run;
  }

  async getAlarm(): Promise<number | null> {
    return this.#alarm;
  }

  /** The time the next `setAlarm` names, once it is called. */
  nextSet(): Promise<number> {
    return new Promise((resolve) => this.#setting.push(resolve));
  }

  async setAlarm(at: number): Promise<void> {
    for (const resolve of this.#setting.splice(0)) resolve(at);
    clearTimeout(this.#timer);
    this.#alarm = at;
    this.#timer = setTimeout(
      () => {
        this.#alarm = null;
        this.alarmed();
      },
      Math.max(0, at - Date.now()),
    );
  }

  /** The alarm let go, as an object evicted with nothing left to wake it for. */
  stop(): void {
    clearTimeout(this.#timer);
  }
}
