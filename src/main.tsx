import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import { initTheme } from "@/utils/theme";
import { initDisplayPrefs } from "@/utils/displayPrefs";
import { initKeyboardInset } from "@/utils/keyboardInset";
import App from "@/App";
import { nativePlatform, storage } from "@/platform";
import "@/utils/configuredDayjs";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { classifyErrorMessage } from "@/utils/errorNoise";

// Message of the thrown error, wherever Sentry put it.
const eventMessage = (event: Sentry.ErrorEvent, hint: Sentry.EventHint): string => {
  const original = hint?.originalException;
  return (
    (original instanceof Error ? original.message : "") ||
    event.exception?.values?.map((v) => v.value ?? "").join(" ") ||
    (typeof event.message === "string" ? event.message : "") ||
    ""
  );
};

// "web", "ios" or "android": every event is tagged so issues can be split by app.
const platform = nativePlatform() ?? "web";

Sentry.init({
  dsn: "https://0e984f575ce18cc4c1dc79cfa56e845e@o4511585490239488.ingest.us.sentry.io/4511585495744512",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  },
  beforeSend(event, hint) {
    // Extension / ResizeObserver noise is dropped; client-environment failures (network,
    // IndexedDB aborts) are kept for trend-spotting but demoted from "error" so they
    // don't bury genuine issues or trigger alerts. See utils/errorNoise.
    const noise = classifyErrorMessage(eventMessage(event, hint));
    if (noise?.type === "drop") return null;
    if (noise?.type === "benign") {
      event.level = "info";
      event.tags = { ...event.tags, benign_failure: noise.kind };
      // Group each kind together regardless of the minified frame it threw from.
      event.fingerprint = [noise.kind];
    }
    return event;
  },
  initialScope: { tags: { platform } },
  // Session replay stays web-only, which keeps the app-store privacy declarations simple.
  integrations: platform === "web" ? [Sentry.replayIntegration()] : [],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.,
  // Enable logs to be sent to Sentry
  enableLogs: true,
});

// Dev only: `?fresh-device` forgets this device's app storage (theme, dismissed tips,
// drawers, drafts) so the app looks as it would on a first visit. It keeps the sign-in.
// See docs/user-states.md.
if (import.meta.env.DEV) {
  const url = new URL(window.location.href);
  if (url.searchParams.has("fresh-device")) {
    const cleared = storage.clearAppKeys();
    url.searchParams.delete("fresh-device");
    window.history.replaceState(null, "", url);
    console.info(`fresh-device: cleared ${cleared} stored app keys`);
  }
}

// Apply the stored theme and display prefs before the first paint so nothing flashes.
initTheme();
initDisplayPrefs();
initKeyboardInset();

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
