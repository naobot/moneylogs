// scripts/personas.ts
//
// Test personas: accounts held at one stage of a new person's life in the app, so
// first-run screens can be checked without signing up by hand every time. Each one is
// built through the same writes the app makes at that stage (registration, then the
// welcome wizard, then use), under the security rules, and can be put back to its
// starting state at any time:
//
//   npm run reset-persona -- fresh     (or empty, lapsed, all)
//
// Resetting deletes the account through the real deleteAccount function, so the
// Functions emulator must be running; whatever the persona did in other people's logs
// is anonymised as "deleted user", exactly as it would be in production.
//
// The seed creates all of them. docs/user-states.md says what each one is for.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Currency } from "../src/types/user";
import { buildNewLedgerDoc } from "../src/utils/ledgerDoc";
import {
  PERSONAL_LEDGER_MAX_PARTICIPANTS,
  PERSONAL_LEDGER_TITLE,
  personalLedgerId,
} from "../src/utils/personalLedger";
import { PASSWORD, auth, db, functions, functionsEmulatorIsUp, ownerWrite } from "./emulator";

export const PERSONA_KEYS = ["fresh", "empty", "lapsed"] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

export const isPersonaKey = (key: string): key is PersonaKey =>
  (PERSONA_KEYS as readonly string[]).includes(key);

type Persona = {
  email: string;
  /** The name typed at sign-up (and kept through the wizard). */
  displayName: string;
  /** One line for the console and the docs: where this person is. */
  stage: string;
  /** What the welcome wizard collected. `fresh` hasn't been through it yet. */
  profile?: { timezone: string; displayLocation: string; currency: Currency };
};

export const PERSONAS: Record<PersonaKey, Persona> = {
  fresh: {
    email: "fresh@test.com",
    displayName: "Frankie Fresh",
    stage: "just signed up; the welcome wizard is next",
  },
  empty: {
    email: "empty@test.com",
    displayName: "Emery Empty",
    stage: "finished the wizard; empty personal log; the tour and Home nudge are still to come",
    profile: { timezone: "America/Toronto", displayLocation: "Toronto", currency: "CAD" },
  },
  lapsed: {
    email: "lapsed@test.com",
    displayName: "Lou Lapsed",
    stage: "set up half a year ago, logged three months of spending, then went quiet",
    profile: { timezone: "Australia/Sydney", displayLocation: "Sydney", currency: "AUD" },
  },
};

const DAY = 24 * 60 * 60 * 1000;

/** "YYYY-MM" for the month `back` months before this one, in a timezone. */
const monthsAgo = (timeZone: string, back: number) => {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  const index = y * 12 + (m - 1) - back;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

/** A few ordinary entries a month: [day, amount, categoryId, note?]. */
const LAPSED_MONTH: ReadonlyArray<[number, number, string, string?]> = [
  [1, 1900, "housing", "Rent"],
  [3, 86.4, "groceries"],
  [8, 24.5, "food", "Lunch with Sam"],
  [12, 61.2, "utilities", "Power"],
  [19, 42, "transport", "Opal top-up"],
];
/** How many months back Lou's last logged month is, and how many they logged. */
const LAPSED_LAST_MONTH_BACK = 4;
const LAPSED_MONTHS = 3;

/**
 * Sign the persona in if the account exists; null if it doesn't. A wrong password means
 * someone changed it in the app, which a reset can't get past.
 */
async function signInIfExists(email: string) {
  try {
    return (await signInWithEmailAndPassword(auth, email, PASSWORD)).user;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") return null;
    if (code === "auth/wrong-password") {
      throw new Error(
        `${email} exists with a different password. Delete it in the Emulator UI (Authentication), then reset again.`,
      );
    }
    throw error;
  }
}

/** Delete the persona's current account, if any, the way the app's "delete account" does. */
async function deleteIfExists(persona: Persona) {
  const user = await signInIfExists(persona.email);
  if (!user) return false;
  if (!(await functionsEmulatorIsUp())) {
    throw new Error(
      "Resetting an existing persona deletes it through the deleteAccount function, but the " +
        "Functions emulator isn't answering on :5001. Build the functions (cd functions && " +
        "npm run build) and restart the emulators.",
    );
  }
  await httpsCallable(functions, "deleteAccount")();
  await signOut(auth);
  return true;
}

/** Registration: what RegistrationHandler + useRegisterNewUser write. */
async function register(persona: Persona) {
  const { user } = await createUserWithEmailAndPassword(auth, persona.email, PASSWORD);
  const ref = await addDoc(collection(db, "users"), {
    userId: user.uid,
    displayName: persona.displayName,
    email: persona.email,
    createdAt: serverTimestamp(),
    groups: [],
    onboardingPending: true,
  });
  await updateProfile(user, { displayName: persona.displayName });
  return { uid: user.uid, userDocId: ref.id };
}

/** The welcome wizard's saves, in its order (WelcomeWizard.saveStep). */
async function finishWelcome(
  { uid, userDocId }: { uid: string; userDocId: string },
  profile: NonNullable<Persona["profile"]>,
) {
  const userRef = doc(db, "users", userDocId);
  await updateDoc(userRef, {
    timezone: profile.timezone,
    displayLocation: profile.displayLocation,
  });
  // ensurePersonalLedger: the personal log first, then the marker on the user doc.
  const ledgerId = personalLedgerId(uid);
  await setDoc(
    doc(db, "ledgers", ledgerId),
    buildNewLedgerDoc({
      title: PERSONAL_LEDGER_TITLE,
      max_participants: PERSONAL_LEDGER_MAX_PARTICIPANTS,
      defaultCurrency: profile.currency,
      member: { uid, userDocId },
      userDocRef: userRef,
      createdAt: serverTimestamp(),
    }),
  );
  await updateDoc(userRef, { personalLedgerId: ledgerId });
  await updateDoc(userRef, {
    defaultCurrency: profile.currency,
    onboardingPending: deleteField(),
  });
  return ledgerId;
}

/** Lou: months of use that stopped. Timestamps the client can't backdate go in as owner. */
async function lapse(
  { uid, userDocId }: { uid: string; userDocId: string },
  ledgerId: string,
  persona: Persona,
) {
  const { timezone, currency } = persona.profile!;
  const userRef = doc(db, "users", userDocId);
  for (
    let back = LAPSED_LAST_MONTH_BACK + LAPSED_MONTHS - 1;
    back >= LAPSED_LAST_MONTH_BACK;
    back--
  ) {
    const month = monthsAgo(timezone, back);
    for (const [day, amount, categoryId, note] of LAPSED_MONTH) {
      await addDoc(collection(db, "ledgers", ledgerId, "entries"), {
        amount,
        currency,
        categoryId,
        date: `${month}-${String(day).padStart(2, "0")}`,
        month,
        ...(note ? { note } : {}),
        author: userRef,
        authorUid: uid,
        authorName: persona.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  const joined = new Date(Date.now() - 190 * DAY);
  const lastSeen = new Date(Date.now() - (LAPSED_LAST_MONTH_BACK * 30 - 20) * DAY);
  await ownerWrite(
    `users/${userDocId}`,
    {
      createdAt: joined,
      // Toured long ago: per log (ledgerTours) and the older one-per-account record.
      tutorials: { ledgerTours: { [ledgerId]: joined }, ledgerTour: joined, ledgerNudge: joined },
      logLastViewedAt: { [ledgerId]: lastSeen },
    },
    { merge: true },
  );
  await ownerWrite(`ledgers/${ledgerId}`, { createdAt: joined }, { merge: true });
}

/**
 * Put a persona back at its starting stage: delete the account if it exists, then build
 * it again. Returns the stage line for logging.
 */
export async function resetPersona(key: PersonaKey) {
  const persona = PERSONAS[key];
  const replaced = await deleteIfExists(persona);
  const ids = await register(persona);
  if (persona.profile) {
    const ledgerId = await finishWelcome(ids, persona.profile);
    if (key === "lapsed") await lapse(ids, ledgerId, persona);
  }
  await signOut(auth);
  return { ...persona, key, replaced };
}
