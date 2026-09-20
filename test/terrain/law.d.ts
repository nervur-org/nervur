// SPDX-License-Identifier: Apache-2.0
// The law's module as a bundle builds it from its source, `nervur:law`,
// which only the terrain run's bundler resolves.
declare module 'nervur:law' {
  export const module: string;
  export const version: string;
  export const classes: unknown[];
}
// The kit as one module's text, as `nervur/edge/kit` carries it, and the
// terrain's kit, the same with the edge scenes inside.
declare module 'nervur:kit' {
  const kit: string;
  export default kit;
}
declare module 'nervur:scenes-kit' {
  const kit: string;
  export default kit;
}
