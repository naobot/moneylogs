/** The friends drawer's one-line summary, e.g. "3 friends · 1 request". */
export const friendsHint = ({ friends, incoming }: { friends: number; incoming: number }) => {
  const parts = [
    friends === 1 ? "1 friend" : `${friends} friends`,
    ...(incoming ? [incoming === 1 ? "1 request" : `${incoming} requests`] : []),
  ];
  return parts.join(" · ");
};
