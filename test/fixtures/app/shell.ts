// A phone shell's two native interfaces, as a shell's author writes them,
// kept in the process: a secret store and a store with compare-and-swap.
// The real ones are the Keychain or the Keystore and a native file.
import type { NativeSecrets, NativeShell, NativeStore } from 'nervur/app';

export class MapSecrets implements NativeSecrets {
  readonly held = new Map<string, string>();

  async get(name: string): Promise<string | null> {
    return this.held.get(name) ?? null;
  }

  async set(name: string, value: string): Promise<void> {
    this.held.set(name, value);
  }
}

export class MapStore implements NativeStore {
  readonly held = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.held.get(key) ?? null;
  }

  async keys(prefix: string): Promise<readonly string[]> {
    return [...this.held.keys()].filter((key) => key.startsWith(prefix));
  }

  async swap(writes: Readonly<Record<string, string | null>>, expect: Readonly<Record<string, string | null>>): Promise<boolean> {
    for (const [key, value] of Object.entries(expect)) if ((this.held.get(key) ?? null) !== value) return false;
    for (const [key, value] of Object.entries(writes)) {
      if (value === null) this.held.delete(key);
      else this.held.set(key, value);
    }
    return true;
  }
}

/** One phone: the same secrets and store across every launch of its app. */
export const phone = (): NativeShell & { secrets: MapSecrets; store: MapStore } => ({ secrets: new MapSecrets(), store: new MapStore() });
