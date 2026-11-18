// Steps several walkthroughs share: signing up, signing in, the welcome wizard.
import type { Locator, Page } from "playwright";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { PASSWORD, auth, db } from "../../scripts/emulator";
import { button, field, waitForPath, type Walkthrough } from "./walkthrough";

/** A password the sign-up form accepts. */
export const NEW_PASSWORD = "Walk-through-2026!";

let counter = 0;
/** A never-used email for a sign-up; the test deletes the account afterwards. */
export const newEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${counter++}@test.com`;

/** On /login: switch to "I'm a new user" if needed, fill it in and register. */
export async function register(w: Walkthrough, email: string) {
  const { page } = w;
  const emailField = field(page, "Email");
  if (!(await button(page, "Register").isVisible())) {
    await button(page, "I'm a new user").click();
  }
  await emailField.fill(email);
  await field(page, "Password").fill(NEW_PASSWORD);
  await w.step("register");
  await button(page, "Register").click();
  await waitForPath(page, /^\/welcome/);
}

/** Sign in from /login as a seeded account or persona, ending wherever it redirects. */
export async function signIn(w: Walkthrough, email: string, password = PASSWORD) {
  const { page } = w;
  if (!new URL(page.url()).pathname.startsWith("/login")) await page.goto("/login");
  if (!(await button(page, "Login").isVisible())) {
    await button(page, "I have an account").click();
  }
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await button(page, "Login").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** The step the wizard says it's on. */
export const currentWizardStep = (page: Page) =>
  page.locator('.Wizard__progress [aria-current="step"]').innerText();

/**
 * Walk the welcome wizard from wherever it is to the end, screenshotting each step.
 * `finish` is the last button's label: "Take me home", or "Finish" when headed elsewhere.
 */
export async function completeWelcome(
  w: Walkthrough,
  {
    name,
    location,
    currency,
    finish,
  }: { name?: string; location?: string; currency: string; finish: string },
) {
  const { page } = w;
  const next = () => button(page, "Next").click();

  await page.getByText("what should we call you?").waitFor();
  if (name) await field(page, "Display name").fill(name);
  await w.step("welcome-name");
  await next();

  await page.getByText("where are you based?").waitFor();
  if (location) await field(page, "Show my location as").fill(location);
  await w.step("welcome-location");
  await next();

  await page.getByText("how should things look?").waitFor();
  await w.step("welcome-display");
  await next();

  await page.getByText("what currency do you usually spend in?").waitFor();
  await page.locator("#welcome-default-currency").selectOption(currency);
  await w.step("welcome-currency");
  await button(page, finish).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/welcome"), { timeout: 20_000 });
}

/** The modal on screen, if any. */
export const modal = (page: Page): Locator => page.locator(".Modal__content");

export type SeededIds = { roommatesGroupId: string; homeLedgerId: string; aliceDocId: string };
let seeded: SeededIds | null = null;

/** Ids the seed makes at random, read back as Alice. */
export async function seededIds(): Promise<SeededIds> {
  if (seeded) return seeded;
  const { user } = await signInWithEmailAndPassword(auth, "alice.vancouver@test.com", PASSWORD);
  try {
    const me = (await getDocs(query(collection(db, "users"), where("userId", "==", user.uid))))
      .docs[0];
    let roommatesGroupId = "";
    for (const id of (me.get("groups") ?? []) as string[]) {
      const group = await getDoc(doc(db, "log_groups", id));
      if (group.get("title") === "Roommates - Vancouver House") roommatesGroupId = id;
    }
    const ledgers = await getDocs(
      query(collection(db, "ledgers"), where("memberUids", "array-contains", user.uid)),
    );
    const homeLedgerId = ledgers.docs.find((l) => l.get("title") === "Alice + Bob home")?.id ?? "";
    if (!roommatesGroupId || !homeLedgerId) {
      throw new Error("Couldn't find Alice's seeded logs. Restart the emulators and seed again.");
    }
    seeded = { roommatesGroupId, homeLedgerId, aliceDocId: me.id };
    return seeded;
  } finally {
    await signOut(auth);
  }
}
