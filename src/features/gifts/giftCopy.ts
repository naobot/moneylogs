/** How many you'll have after giving one away, e.g. "you'll keep 2 acorns." */
export const giftLeftLine = (itemName: string, owned: number): string => {
  const left = owned - 1;
  if (left <= 0) return `it's your only ${itemName}.`;
  return `you'll keep ${left}.`;
};
