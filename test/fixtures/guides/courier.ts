// courier.ts
// The courier's side of her standing, one function for each method of
// her need. On the bench a stand-in runs them in the house's own runner.
export const pickup = ({ items }: { items: string[] }): void => {
  if (items.length === 0) throw new Error('Nothing to pick up.');
};
