// F1. Sign up → welcome wizard → Home (docs/user-states.md)
import { afterAll, describe, expect, it } from "vite-plus/test";
import { deleteAccountIfExists, PERSONAS, resetPersona } from "../scripts/personas";
import { VARIANTS } from "./support/env";
import {
  completeWelcome,
  currentWizardStep,
  modal,
  NEW_PASSWORD,
  newEmail,
  register,
  signIn,
} from "./support/flows";
import { button, closeBrowser, openWalkthrough, waitForPath } from "./support/walkthrough";

const signedUp: string[] = [];

afterAll(async () => {
  await closeBrowser();
  for (const email of signedUp) await deleteAccountIfExists(email, NEW_PASSWORD);
});

describe.each(VARIANTS)("F1 sign up ($id)", (variant) => {
  it("a new email registers, finishes the wizard and lands on Home", async () => {
    const w = await openWalkthrough("F1a-new-email", "F1a · new email → wizard → Home", variant);
    const { page } = w;
    try {
      const email = newEmail("f1");
      signedUp.push(email);

      await page.goto("/login");
      await w.step("login");
      await register(w, email);

      await completeWelcome(w, {
        name: "Fern Firstrun",
        location: "Vancouver",
        currency: "CAD",
        finish: "Take me home",
      });
      await waitForPath(page, /^\/$/);
      await page.locator(".Home").waitFor();
      // The nudge waits on the personal log's entries query.
      await page.getByRole("complementary", { name: "Your personal log" }).waitFor();
      await w.step("home");

      // New accounts chose a currency in the wizard; they're never asked again.
      expect(await page.getByText("your currency").isVisible()).toBe(false);

      await page.reload();
      await page.locator(".Home").waitFor();
      expect(new URL(page.url()).pathname).toBe("/");
      await w.step("home-after-reload");
      w.done();
    } finally {
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });

  it("an unfinished sign-up resumes the wizard, then goes where they were headed", async () => {
    const w = await openWalkthrough(
      "F1b-resume",
      "F1b · fresh@ opens /notifications → wizard (reload, back) → /notifications",
      variant,
    );
    const { page } = w;
    try {
      await resetPersona("fresh");

      await page.goto("/notifications");
      await waitForPath(page, /^\/login/);
      await w.step("login");
      await signIn(w, PERSONAS.fresh.email);
      await waitForPath(page, /^\/welcome\?next=%2Fnotifications/);
      await w.step("welcome-resumed");

      // Reloading mid-wizard keeps the step; Back returns to the one before.
      await button(page, "Next").click();
      await page.getByText("where are you based?").waitFor();
      await page.reload();
      await page.getByText("where are you based?").waitFor();
      expect(await currentWizardStep(page)).toMatch(/location/i);
      await w.step("location-after-reload");
      await button(page, "Back").click();

      await completeWelcome(w, { currency: "AUD", finish: "Finish" });
      await waitForPath(page, /^\/notifications/);
      await w.step("notifications");
      expect(await modal(page).count()).toBe(0);
      w.done();
    } finally {
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });
});
