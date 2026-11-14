/**
 * The title and body of a push notification for an inbox notification.
 *
 * Keep in step with the in-app copy in src/utils/notificationTypes.ts (describe/detail).
 * Functions is a separate package, so the wording is restated here as plain text; the
 * link a tap opens is not: the app resolves it from the stored notification.
 */
export type PushCopy = { title: string; body: string };

type Data = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const num = (value: unknown): number => (typeof value === "number" ? value : 0);

const money = (value: number, currency: string) =>
  `${value.toLocaleString("en", { maximumFractionDigits: 2 })} ${currency}`;

const budgetSubject = (data: Data) =>
  data.categoryName
    ? `the ${str(data.categoryName)} ${str(data.currency)} budget`
    : `your ${str(data.currency)} budget`;

const spentOfBudget = (data: Data) =>
  `${money(num(data.spent), str(data.currency))} of ${money(num(data.budget), str(data.currency))}`;

/**
 * Push copy for one notification, or null when it shouldn't be pushed: notes about the
 * recipient's own actions (starting or joining a log) and types this build doesn't know.
 * The log's name is the title; the body says what happened.
 */
export const pushCopy = (data: Data): PushCopy | null => {
  const title = str(data.groupName) || "moneylogs";
  const actor = str(data.actorName) || "Someone";
  const yourPost = data.reason === "subscriber" ? "a post you follow" : "your post";

  switch (data.type) {
    case "comment": {
      const excerpt = str(data.excerpt);
      const what = `${actor} commented on ${yourPost}`;
      return { title, body: excerpt ? `${what}: ${excerpt}` : what };
    }
    case "reaction":
      return { title, body: `${actor} reacted ${str(data.emoji)} to ${yourPost}` };
    case "log_ending":
      return { title, body: "Ends within a day: last chance to post." };
    case "log_ended":
      return { title, body: "This log has ended." };
    case "budget_approaching": {
      const budget = num(data.budget);
      const pct = budget > 0 ? Math.floor((num(data.spent) / budget) * 100) : 100;
      return { title, body: `${pct}% of ${budgetSubject(data)} used (${spentOfBudget(data)}).` };
    }
    case "budget_exceeded":
      return { title, body: `Over ${budgetSubject(data)} (${spentOfBudget(data)}).` };
    case "budget_projected":
      return { title, body: `On track to go over ${budgetSubject(data)} this month.` };
    default:
      return null;
  }
};

/**
 * FCM error codes that mean the token will never work again, so its device is dropped.
 * Not "invalid-argument": a bad payload returns it for every token at once.
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/** Which of `deviceIds` to delete, given FCM's per-token results (same order). */
export const deadDevices = (
  deviceIds: ReadonlyArray<string>,
  results: ReadonlyArray<{ success: boolean; error?: { code?: string } }>,
): string[] =>
  deviceIds.filter((_, i) => {
    const result = results[i];
    return !!result && !result.success && DEAD_TOKEN_CODES.has(result.error?.code ?? "");
  });
