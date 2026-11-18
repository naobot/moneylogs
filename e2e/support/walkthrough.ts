// A walkthrough is one flow, in one browser variant, with a screenshot at every step.
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { BASE_URL, BROWSER_TIMEZONE, NOTES_DIR, PHONE, SCREENS_DIR, type Variant } from "./env";
import type { WalkthroughNotes } from "./contactSheet";

let browser: Browser | null = null;

export async function closeBrowser() {
  await browser?.close();
  browser = null;
}

/** Hosts the app may reach: the dev server and the emulators, nothing in production. */
const isLocal = (url: string) => {
  const { hostname, protocol } = new URL(url);
  return (
    protocol === "data:" ||
    protocol === "blob:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
};
/** Requests that would mean the app is talking to the real backend. */
const PRODUCTION_BACKEND =
  /firestore\.googleapis|identitytoolkit|securetoken|cloudfunctions|firebasestorage/;

export type Walkthrough = {
  page: Page;
  /** Wait for the screen to settle, then screenshot it as the next step. */
  step: (name: string) => Promise<void>;
  /** Uncaught errors and production requests: a walkthrough should end with none. */
  problems: () => string[];
  /** Mark the flow as completed (call at the end of the test body). */
  done: () => void;
  isDone: () => boolean;
  close: () => Promise<void>;
};

export async function openWalkthrough(
  walkthrough: string,
  title: string,
  variant: Variant,
): Promise<Walkthrough> {
  browser ??= await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: BROWSER_TIMEZONE,
    locale: "en-CA",
  });
  // A new context is a first visit: nothing stored but the theme for this variant.
  await context.addInitScript((theme) => {
    try {
      window.localStorage.setItem("ML__theme", theme);
    } catch {
      // ignore
    }
  }, variant.theme);
  // The Auth emulator's "Running in emulator mode" banner is fixed to the bottom of the
  // page and covers bottom bars (the invite bar), so it's hidden here.
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = ".firebase-emulator-warning { display: none !important; }";
      document.head.append(style);
    });
  });

  const notes: WalkthroughNotes = {
    walkthrough,
    title,
    variant: variant.id,
    finished: false,
    pageErrors: [],
    consoleErrors: [],
    blockedRequests: [],
  };
  // Only the dev server and emulators are reachable. Analytics, Sentry and anything else
  // external are dropped; a production backend request is a failure.
  await context.route(
    (url) => !isLocal(url.href),
    (route) => {
      const url = route.request().url();
      if (PRODUCTION_BACKEND.test(url)) notes.blockedRequests.push(url);
      return route.abort();
    },
  );

  const page = await context.newPage();
  page.on("pageerror", (err) => notes.pageErrors.push(err.message));
  page.on("console", (msg) => {
    // Aborted external requests (analytics, Sentry) log as failed resource loads.
    if (msg.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(msg.text())) {
      notes.consoleErrors.push(msg.text());
    }
  });

  const dir = path.join(SCREENS_DIR, walkthrough, variant.id);
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;

  return {
    page,
    async step(name) {
      await settle(page);
      n++;
      await page.screenshot({
        path: path.join(dir, `${String(n).padStart(2, "0")}-${name}.png`),
        fullPage: true,
      });
    },
    problems: () => [
      ...notes.pageErrors.map((e) => `page error: ${e}`),
      ...notes.blockedRequests.map((u) => `production backend request: ${u}`),
    ],
    done() {
      notes.finished = true;
    },
    isDone: () => notes.finished,
    async close() {
      fs.mkdirSync(NOTES_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(NOTES_DIR, `${walkthrough}__${variant.id}.json`),
        JSON.stringify(notes, null, 2),
      );
      await context.close();
    },
  };
}

/** Fonts loaded, nothing mid-transition. Firestore keeps a channel open, so no networkidle. */
async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------
// Finding things. Text fields' <label>s aren't tied to their inputs (no htmlFor), so
// they're found by the label inside the same .ControlledInput.
// ---------------------------------------------------------------------------
export const field = (page: Page, label: string): Locator =>
  page
    .locator(".ControlledInput__input, .PlacePicker")
    .filter({ has: page.locator("label").getByText(label, { exact: true }) })
    .locator("input, select")
    .first();

export const button = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole("button", { name, exact: true });

/** Wait for a URL whose path (and query, if given) matches. */
export const waitForPath = (page: Page, pattern: RegExp) =>
  page.waitForURL((url) => pattern.test(url.pathname + url.search), { timeout: 20_000 });
