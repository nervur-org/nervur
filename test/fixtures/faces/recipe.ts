// recipe.ts
import { Api, apiOffer } from './api.ts';

// A registry: the ground raises the face by its `up` when an entry names it.
export const faculties = {
  face: { up: () => apiOffer(new Api()) },
};
