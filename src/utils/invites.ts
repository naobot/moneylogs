/** Where someone's personal invite link points (see features/invites). */
export const invitePath = (code: string) => `/invite/${code}`;

/**
 * Whether acceptInvite failed because the link itself is bad (unknown, reset or
 * malformed code) rather than something worth retrying. Callable errors carry codes
 * like "functions/not-found".
 */
export const isInviteNotFound = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "functions/not-found" || code === "functions/invalid-argument";
};
