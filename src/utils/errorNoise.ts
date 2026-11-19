// Error messages that aren't app bugs, shared by the Sentry beforeSend (main.tsx) and
// the GlobalErrorHandler toast (utils/errorHandler.ts), so both treat them the same.

// Pure third-party / benign noise with no diagnostic value: browser-extension
// content scripts (iOS Safari content blockers, password managers, translators)
// whose runtime.sendMessage fails when the tab context is gone ("Invalid call to
// runtime.sendMessage(). Tab not found."), extension context teardown, and the
// harmless ResizeObserver loop warning. Neither sent to Sentry nor shown to the user.
const DROP_PATTERNS = [
  "runtime.sendMessage",
  "Tab not found",
  "Extension context invalidated",
  "ResizeObserver loop",
];

// Failures in the client environment, mostly from inside the Firebase SDK. Still sent
// to Sentry (a spike can flag a real outage) but as "info", grouped by kind, and
// never toasted: there's nothing the user can act on.
const BENIGN_KINDS = [
  {
    // Browser network-layer fetch failures: Safari/WebKit "Load failed", Chromium
    // "Failed to fetch". Analytics config fetch to firebase.googleapis.com, Firestore
    // WebChannel transport; ad/tracking blockers, flaky connections, a tab closed
    // mid-request. Firestore retries and offline persistence recover.
    kind: "network-fetch-failure",
    patterns: ["Load failed", "Failed to fetch"],
  },
  {
    // Chromium's AbortError for an IndexedDB transaction aborted because a handler
    // threw. Seen from @firebase/installations (started by Analytics), which leaves
    // tx.done unawaited when its read fails, so the abort lands as an unhandled
    // rejection. Typically right after boot while offline.
    kind: "indexeddb-abort",
    patterns: ["Uncaught exception in event handler"],
  },
] as const;

export type BenignKind = (typeof BENIGN_KINDS)[number]["kind"];

export type ErrorNoise = { type: "drop" } | { type: "benign"; kind: BenignKind } | null;

/** How to treat an error by its message: drop it, report it quietly, or (null) as a bug. */
export const classifyErrorMessage = (message: string): ErrorNoise => {
  if (DROP_PATTERNS.some((pattern) => message.includes(pattern))) return { type: "drop" };
  const benign = BENIGN_KINDS.find(({ patterns }) =>
    patterns.some((pattern) => message.includes(pattern)),
  );
  return benign ? { type: "benign", kind: benign.kind } : null;
};
