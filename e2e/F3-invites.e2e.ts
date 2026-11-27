// F3. Signing up through an invite (docs/user-states.md)
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { deleteAccountIfExists, PERSONAS, resetPersona } from "../scripts/personas";
import { VARIANTS } from "./support/env";
import {
  completeWelcome,
  modal,
  NEW_PASSWORD,
  newEmail,
  register,
  seededIds,
  signIn,
  type SeededIds,
} from "./support/flows";
import {
  button,
  closeBrowser,
  openWalkthrough,
  waitForPath,
  type Walkthrough,
} from "./support/walkthrough";

const FRIEND_INVITE = "/invite/alice-0001";
const signedUp: string[] = [];
let ids: SeededIds;

beforeAll(async () => {
  ids = await seededIds();
});

// Deleting them takes them back out of Alice's logs and friends. After each test, not at
// the end: Alice + Bob's financial log only has room for four.
afterEach(async () => {
  for (const email of signedUp.splice(0)) await deleteAccountIfExists(email, NEW_PASSWORD);
});

afterAll(closeBrowser);

/** Signed out at an invite link: the landing page, then sign up from its invite bar. */
async function signUpFromInvite(w: Walkthrough, invitePath: string, tag: string) {
  const { page } = w;
  const email = newEmail(tag);
  signedUp.push(email);

  await page.goto(invitePath);
  const bar = page.getByRole("complementary", { name: "Invitation" });
  await bar.waitFor();
  await w.step("landing");
  await bar.getByText("Create an account").click();
  await waitForPath(page, /^\/login/);
  await register(w, email);
  // The wizard remembers the invite.
  expect(new URL(page.url()).searchParams.get("next")).toBe(invitePath);
  await completeWelcome(w, { name: `Ivy ${tag}`, currency: "CAD", finish: "Finish" });
}

/** Alice's profile, showing the two of them as friends. */
async function expectFriendsWithAlice(w: Walkthrough) {
  const { page } = w;
  await waitForPath(page, new RegExp(`^/u/${ids.aliceDocId}`));
  // The words, not a class: the friends state has been a badge, a menu button and
  // (docs/design PLAN item 30) plain status text.
  await page.locator(".FriendControls").getByText("✓ friends").waitFor();
  expect(await page.locator("h2").first().innerText()).toBe("Alice Chen");
}

describe.each(VARIANTS)("F3 invites ($id)", (variant) => {
  it("a friend invite: sign up, and you're friends with Alice", async () => {
    const w = await openWalkthrough(
      "F3a-friend",
      "F3a · friend invite → sign up → friends",
      variant,
    );
    try {
      await signUpFromInvite(w, FRIEND_INVITE, "friend");
      await expectFriendsWithAlice(w);
      await w.step("friends-with-alice");
      w.done();
    } finally {
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });

  it("a social log invite: sign up, join, and the log is on Home", async () => {
    const w = await openWalkthrough(
      "F3b-social-log",
      "F3b · group log invite → sign up → join",
      variant,
    );
    const { page } = w;
    try {
      const invitePath = `/g/${ids.roommatesGroupId}/invite`;
      await signUpFromInvite(w, invitePath, "group");
      await waitForPath(page, new RegExp(`^${invitePath}`));
      await modal(page).getByText("Welcome to").waitFor();
      await w.step("join-prompt");
      await button(modal(page), "Join").click();

      await page.waitForURL((url) => !url.pathname.endsWith("/invite"), { timeout: 20_000 });
      await page.getByText("Roommates - Vancouver House").first().waitFor();
      await w.step("after-join");
      w.done();
    } finally {
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });

  it("a financial log invite: sign up, join, and land in the log", async () => {
    const w = await openWalkthrough(
      "F3c-ledger",
      "F3c · financial log invite → sign up → join",
      variant,
    );
    const { page } = w;
    try {
      const invitePath = `/l/${ids.homeLedgerId}/invite`;
      await signUpFromInvite(w, invitePath, "ledger");
      await waitForPath(page, new RegExp(`^${invitePath}`));
      await page.getByText("You've been invited to share a financial log.").waitFor();
      await w.step("join-prompt");
      await button(page, "Join").click();

      await waitForPath(page, new RegExp(`^/l/${ids.homeLedgerId}$`));
      await page.getByText("Alice + Bob home").first().waitFor();
      await w.step("ledger");
      w.done();
    } finally {
      if (!w.isDone()) await w.step("last-screen");
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });

  it("an existing account opening a friend invite", async () => {
    const w = await openWalkthrough("F3d-existing", "F3d · empty@ opens a friend invite", variant);
    const { page } = w;
    try {
      await resetPersona("empty");
      await page.goto(FRIEND_INVITE);
      await page.getByRole("complementary", { name: "Invitation" }).waitFor();
      await page.getByRole("complementary", { name: "Invitation" }).getByText("or sign in").click();
      await waitForPath(page, /^\/login/);
      await signIn(w, PERSONAS.empty.email);
      await expectFriendsWithAlice(w);
      await w.step("friends-with-alice");
      w.done();
    } finally {
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });

  it("an existing account signing in from a financial log invite, then joining", async () => {
    const w = await openWalkthrough(
      "F3f-ledger-sign-in",
      "F3f · empty@ signs in from a financial log invite → join",
      variant,
    );
    const { page } = w;
    try {
      await resetPersona("empty");
      const invitePath = `/l/${ids.homeLedgerId}/invite`;
      await page.goto(invitePath);
      await page.getByRole("complementary", { name: "Invitation" }).getByText("or sign in").click();
      await waitForPath(page, /^\/login/);
      await signIn(w, PERSONAS.empty.email);
      await w.step("after-sign-in");
      await page.getByText("You've been invited to share a financial log.").waitFor();
      await button(page, "Join").click();
      await waitForPath(page, new RegExp(`^/l/${ids.homeLedgerId}$`));
      await w.step("ledger");
      w.done();
    } finally {
      if (!w.isDone()) await w.step("last-screen");
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });

  it("Alice opening her own invite link", async () => {
    const w = await openWalkthrough("F3e-own-link", "F3e · Alice opens her own link", variant);
    const { page } = w;
    try {
      await page.goto("/login");
      await signIn(w, "alice.vancouver@test.com");
      await page.goto(FRIEND_INVITE);
      await modal(page).getByText("This is your invite link").waitFor();
      await w.step("own-link");
      w.done();
    } finally {
      await w.close();
    }
    expect(w.problems()).toEqual([]);
  });
});
