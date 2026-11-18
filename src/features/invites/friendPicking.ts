/** Pure picking rules for FriendPicker, so they can be unit tested. */

/** Your friends who aren't in the log already, in a stable order. */
export const pickableFriends = (
  friends: ReadonlyArray<string>,
  excludeIds: ReadonlyArray<string>,
): string[] => {
  const exclude = new Set(excludeIds);
  return [...new Set(friends)].filter((id) => !exclude.has(id));
};

/** Tick or untick a friend; ticking past `max` does nothing. */
export const toggleFriend = (
  selected: ReadonlyArray<string>,
  id: string,
  max: number,
): string[] => {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (selected.length >= max) return [...selected];
  return [...selected, id];
};
