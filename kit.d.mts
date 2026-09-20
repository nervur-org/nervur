// SPDX-License-Identifier: Apache-2.0
import type { Plugin } from 'esbuild';

export declare const kitText: (parts: { edge: string; ground: string; resolveDir: string; minify?: boolean; plugins?: Plugin[]; sourcemap?: boolean; extra?: string }) => Promise<string>;
