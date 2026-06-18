import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "./App";
import "./utils/configuredDayjs";
import { CurrentUserProvider } from "./contexts/CurrentUserContext";
import { ToastProvider } from "./contexts/ToastContext";

Sentry.init({
  dsn: "https://0e984f575ce18cc4c1dc79cfa56e845e@o4511585490239488.ingest.us.sentry.io/4511585495744512",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
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
        <App />
      </ToastProvider>
    </CurrentUserProvider>
  </StrictMode>,
);
