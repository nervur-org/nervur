// SPDX-License-Identifier: Apache-2.0
// The ground in a phone's app: a BrowserGround in the shell's web view,
// on the two bodies the shell hands in. Its seeds rest in the platform's
// Keychain or Keystore, and its memory in a native store the system never
// evicts. The code arrives signed in the app's bundle, and one web view
// runs, so the lock is taken at once. A wake by push is the app's own
// recipe's faculty, since the library ships no faculty.
import { BrowserGround, type BrowserGroundOptions } from '../browser/browser-ground.ts';
import { NativeCustody, NativeMemory, type NativeSecrets, type NativeStore } from './native.ts';

/** What the shell hands the ground: its secret store and its native store. */
export interface NativeShell {
  readonly secrets: NativeSecrets;
  readonly store: NativeStore;
}

export interface AppGroundOptions extends Omit<BrowserGroundOptions, 'platform'> {
  readonly shell: NativeShell;
  /** Loads a module of classes by URL, where the app's build hands its own. */
  readonly load?: (href: string) => Promise<unknown>;
  /** Where its classes stand; the web view's own origin where omitted. */
  readonly origin?: string;
}

export const AppGround = Object.freeze({
  /** The app's ground: a BrowserGround whose custody and memory are the shell's own. */
  open({ shell, load, origin, ...options }: AppGroundOptions): Promise<BrowserGround> {
    return BrowserGround.open({
      ...options,
      platform: {
        custody: async () => new NativeCustody(shell.secrets),
        memory: async (name) => new NativeMemory(shell.store, name),
        // The system keeps an app's own store, so there is nothing to ask.
        persist: async () => true,
        ...(load === undefined ? {} : { load }),
        ...(origin === undefined ? {} : { origin }),
      },
    });
  },
});
