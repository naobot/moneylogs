type Counts = {
  financial: number;
  ongoing: number;
  upcoming: number;
  past: number;
  archived: number;
};

/** One-line hint for the closed "My logs" drawer, e.g. "2 ongoing · 5 past". Zeros omitted. */
export const myLogsHint = (counts: Counts): string => {
  const parts = (Object.keys(counts) as Array<keyof Counts>)
    .filter((key) => counts[key] > 0)
    .map((key) => `${counts[key]} ${key}`);
  return parts.length > 0 ? parts.join(" · ") : "none yet";
};
