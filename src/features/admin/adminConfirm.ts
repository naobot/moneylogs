/**
 * What an admin types to confirm deleting an account: the sign-in email, or the uid when
 * there's none. Mirrors confirmsAccount in functions/src/adminPlan.ts, which checks again.
 */
type Account = { uid: string; email: string | null };

export const accountConfirmPhrase = (account: Account) => account.email || account.uid;

export const confirmsAccount = (typed: string, account: Account) =>
  typed.trim().length > 0 &&
  typed.trim().toLowerCase() === accountConfirmPhrase(account).trim().toLowerCase();
