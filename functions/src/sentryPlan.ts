/**
 * Pure helpers for Sentry in Cloud Functions (sentry.ts). Free of SDK imports so they run
 * in the root Vitest suite.
 */

/**
 * HttpsError codes a callable throws on purpose to tell the caller "no" (bad input, not a
 * member, already done). They're answers, not failures, so Sentry never hears about them.
 */
const EXPECTED_HTTPS_CODES = new Set([
  "invalid-argument",
  "failed-precondition",
  "out-of-range",
  "unauthenticated",
  "permission-denied",
  "not-found",
  "already-exists",
  "resource-exhausted",
  "cancelled",
]);

/** HttpsError is recognised by shape: it carries a string `code` and an `httpErrorCode`. */
const httpsCode = (error: unknown): string | undefined => {
  const e = error as { code?: unknown; httpErrorCode?: unknown } | null;
  return e && typeof e.code === "string" && e.httpErrorCode !== undefined ? e.code : undefined;
};

/** Should an error escaping a function's handler go to Sentry? */
export const shouldReport = (error: unknown): boolean => {
  const code = httpsCode(error);
  return code === undefined || !EXPECTED_HTTPS_CODES.has(code);
};

/** What Sentry is told about one invocation. Ids only: never names, emails or content. */
export type InvocationContext = {
  /** The exported function's name; the `function` tag. */
  fn: string;
  /** The caller's auth uid, for callables. */
  uid?: string;
  /** Path params of a Firestore trigger (ledgerId, postId...). */
  params?: Record<string, string>;
};

const stringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * Pull ids from a handler's first argument: a callable's CallableRequest (auth.uid) or a
 * trigger's CloudEvent (params). Anything else (a scheduler event) adds nothing.
 */
export const invocationContext = (fn: string, arg: unknown): InvocationContext => {
  const a = arg as { auth?: { uid?: unknown } | null; params?: unknown } | null | undefined;
  const uid = typeof a?.auth?.uid === "string" ? a.auth.uid : undefined;
  const params = stringRecord(a?.params);
  return { fn, ...(uid ? { uid } : {}), ...(params ? { params } : {}) };
};
