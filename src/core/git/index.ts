// SPDX-License-Identifier: Apache-2.0
// Git, as much of it as a harbor keeps its code in: objects byte for byte
// as git writes them, zlib, a packfile read with its deltas, and the
// fetching side of smart HTTP. Pure: it names no platform, and knows no
// being, no ward and no harbor.
export { deflate, inflate, inflateAt } from './zlib.ts';
export { blob, commit, deflated, DIRECTORY, EMPTY_TREE, FILE, idOf, inflated, isId, loose, readCommit, readLoose, readTree, sha1, text, tree, type Commit, type GitObject, type ObjectType, type Signature, type TreeEntry } from './object.ts';
export { applyDelta, FLUSH, pkt, readPack, readPkts } from './pack.ts';
export { files, HeldObjects, need, reachable, StagedObjects, writeCommit, writeTree, type ObjectStore } from './store.ts';
export { fetchPack, HAVES, havesFrom, listRefs, type Refs } from './http.ts';
