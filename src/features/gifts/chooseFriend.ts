/**
 * Who a gift goes to: the friend picked in the dropdown, else the one preselected (giving
 * from their profile), else the first friend. Only current friends count, and it's worked
 * out from the live list each render, so a preselection made before the list loads holds.
 */
export const chooseFriend = (
  picked: string,
  preselected: string | undefined,
  friends: ReadonlyArray<string>,
): string => [picked, preselected].find((id) => id && friends.includes(id)) ?? friends[0] ?? "";
