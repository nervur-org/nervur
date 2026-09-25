// recipe.ts
import { Api, apiOffer } from './api.ts';

// A registry: the ground makes the face when an entry names its maker.
export const faculties = {
  face: () => apiOffer(new Api()),
};
