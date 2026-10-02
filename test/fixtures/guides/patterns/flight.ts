// The airline's side of the trip's standing, as a stand-in answers it.
export const book = ({ seats }: { seats: number }): void => {
  if (seats > 4) throw new Error('No flight has that many seats.');
};
