// SPDX-License-Identifier: Apache-2.0
// The two native bodies of a phone's ground, over what the shell hands in.
// The shell's secret store is the iOS Keychain or the Android Keystore, and
// its store is a native file or database the operating system never
// evicts. The library holds the contracts' logic; a shell holds only the
// two small interfaces below, in its own native code.
import { KeptCustody, KeptMemory, type Secrets, type Store } from '../bodies/kept.ts';

/** The platform's secret store: text by name, kept by the Keychain or the Keystore, on this device alone. */
export type NativeSecrets = Secrets;

/** A native store of text by key, which the operating system never evicts, with a swap that lands only where nothing moved. */
export type NativeStore = Store;

/** One seed for each house in the platform's secret store, drawn on first use. The store is the protection, on this device alone. */
export class NativeCustody extends KeptCustody {}

/** Memory in the native store, one for each name, which the system never evicts. */
export class NativeMemory extends KeptMemory {}
