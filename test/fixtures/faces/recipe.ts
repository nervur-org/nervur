// recipe.ts
import { Api, apiOffer } from './api.ts';

export const faculties = () => ({
  face: apiOffer(new Api()),
});
