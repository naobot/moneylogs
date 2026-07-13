import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "@/App";
import "@/utils/configuredDayjs";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { TutorialProvider } from "@/contexts/TutorialContext";

// Browser network-layer fetch failures — Safari/WebKit reports "Load failed",
// Chromium "Failed to fetch". In this app these surface almost entirely from
// inside the Firebase SDK (Analytics config fetch to firebase.googleapis.com,
// Firestore WebChannel transport) and are caused by the client environment:
// ad/tracking blockers, flaky mobile connections, or a tab closed mid-request.
// They are not app bugs and Firestore retries + offline persistence recover.
// We keep sending them (a spike can still flag a real outage) but demote them
// from "error" so they don't bury genuine issues or trigger alerts.
const NETWORK_FETCH_ERROR_PATTERNS = ["Load failed", "Failed to fetch"];

const isNetworkFetchError = (event: Sentry.ErrorEvent, hint: Sentry.EventHint): boolean => {
  const original = hint?.originalException;
  const message =
    (original instanceof Error ? original.message : "") ||
    event.exception?.values?.map((v) => v.value ?? "").join(" ") ||
    (typeof event.message === "string" ? event.message : "") ||
    "";
  return NETWORK_FETCH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

Sentry.init({
  dsn: "https://0e984f575ce18cc4c1dc79cfa56e845e@o4511585490239488.ingest.us.sentry.io/4511585495744512",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  },
  beforeSend(event, hint) {
    if (isNetworkFetchError(event, hint)) {
      event.level = "info";
      event.tags = { ...event.tags, network_fetch_failure: true };
      // Group them together regardless of the minified frame they threw from.
      event.fingerprint = ["network-fetch-failure"];
    }
    return event;
  },
  integrations: [Sentry.replayIntegration()],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.,
  // Enable logs to be sent to Sentry
  enableLogs: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CurrentUserProvider>
      <ToastProvider>
        <TutorialProvider>
          <App />
        </TutorialProvider>
      </ToastProvider>
    </CurrentUserProvider>
  </StrictMode>,
);
