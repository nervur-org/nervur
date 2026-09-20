// SPDX-License-Identifier: Apache-2.0
// A claim of the paper, named by the test that holds it. The paper marks a
// claim `<!-- claim: id -->`, a test titles itself with `holds(id, what)`,
// and `test/kit/claims.test.ts` refuses a claim no test holds and an id
// no claim declares. So the rule that a test is traced to a sentence is a
// check, not a wish.
export const holds = (claim: string, what: string): string => `[${claim}] ${what}`;
