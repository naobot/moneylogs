// scripts/seed-review-account.ts
//
// Makes the demo account App Review and Play review sign in with: one person, their
// personal financial log with this month's spending against a couple of budgets, and an
// ongoing log group with a few posts. It runs once per account.
//
// Writes go through the client SDK as the reviewer, so the security rules check every
// shape exactly as they do for the app. Month totals and budget alerts come from the
// Cloud Functions that react to the entries, as for anyone else.
//
// Try it on the emulators first (functions built and running for the totals):
//   REVIEW_EMAIL=review@test.com REVIEW_PASSWORD=… npx tsx scripts/seed-review-account.ts --emulator
//
// Then for production, with the web app's Firebase config in the environment (the same
// VITE_FIREBASE_* values the build uses, e.g. from .env):
//   REVIEW_EMAIL=… REVIEW_PASSWORD=… npx tsx --env-file=.env scripts/seed-review-account.ts
// Put the email and password in the store listings' review notes, never in the repo.
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

// Outside the app tsconfig: declare the bits of Node this uses.
declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

const emulator = process.argv.includes("--emulator");
const email = process.env.REVIEW_EMAIL;
const password = process.env.REVIEW_PASSWORD;
if (!email || !password) {
  console.error("Set REVIEW_EMAIL and REVIEW_PASSWORD (see the top of this file).");
  process.exit(1);
}

const env = (key: string) => {
  const value = process.env[key];
  if (!value && !emulator) {
    console.error(`${key} is missing: run with --env-file=.env, or --emulator.`);
    process.exit(1);
  }
  return value ?? `mock-${key}`;
};

const app = initializeApp({
  apiKey: env("VITE_FIREBASE_API_KEY"),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: "moneylogs-89ebf",
  storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("VITE_FIREBASE_APP_ID"),
});
const auth = getAuth(app);
const db = getFirestore(app);
if (emulator) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8888);
}

const TIMEZONE = "America/Vancouver";
const CURRENCY = "CAD";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

/** Today's date in the reviewer's zone, as YYYY-MM-DD. */
const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(NOW));
const thisMonth = today.slice(0, 7);
const dayOfMonth = Number(today.slice(8));
/** A day this month that isn't in the future. */
const dateThisMonth = (day: number) =>
  `${thisMonth}-${String(Math.min(day, dayOfMonth)).padStart(2, "0")}`;

const wallClock = (ms: number) => new Date(ms).toISOString().slice(0, 16);

// The same categories a new financial log gets, two of them with budgets.
const CATEGORY_NAMES = [
  "Food",
  "Groceries",
  "Transport",
  "Housing",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Travel",
  "Other",
];
const BUDGETS: Record<string, number> = { food: 300, groceries: 400 };
const categories = CATEGORY_NAMES.map((name, order) => {
  const id = name.toLowerCase();
  return {
    id,
    name,
    order,
    ...(BUDGETS[id] ? { budget: { [CURRENCY]: BUDGETS[id] } } : {}),
  };
});

const ENTRIES = [
  { day: 1, amount: 1450, categoryId: "housing", note: "Rent" },
  { day: 2, amount: 86.4, categoryId: "groceries", note: "Weekly shop" },
  { day: 3, amount: 18.5, categoryId: "food", note: "Ramen with a friend" },
  { day: 5, amount: 2.75, categoryId: "transport" },
  { day: 6, amount: 64.2, categoryId: "utilities", note: "Phone bill" },
  { day: 8, amount: 112.9, categoryId: "groceries" },
  { day: 9, amount: 42, categoryId: "entertainment", note: "Concert tickets" },
  { day: 11, amount: 27.3, categoryId: "food" },
  { day: 12, amount: 95.15, categoryId: "groceries", note: "Market + bakery" },
];

const POSTS = [
  { daysAgo: 2, amount: 24, content: "Bus pass top-up for the weekend. Ferry tomorrow!" },
  { daysAgo: 1, amount: 38.5, content: "Fish and chips on the pier. Worth every cent." },
  { daysAgo: 0, amount: 12, content: "Two coffees and a cinnamon bun before the hike." },
];

async function seed() {
  console.log(`🌱 Review account on ${emulator ? "the emulators" : "PRODUCTION"}: ${email}`);

  let uid: string;
  try {
    ({
      user: { uid },
    } = await createUserWithEmailAndPassword(auth, email!, password!));
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/email-already-in-use") {
      console.error(
        "That account already exists. Delete it from /me first, or pick another email.",
      );
      process.exit(1);
    }
    throw error;
  }

  // Like registration (random doc id, uid in userId), with onboarding already done.
  const userRef = await addDoc(collection(db, "users"), {
    userId: uid,
    email,
    displayName: "Robin",
    displayLocation: "Vancouver",
    timezone: TIMEZONE,
    defaultCurrency: CURRENCY,
    createdAt: serverTimestamp(),
    groups: [],
  });
  console.log("✅ user");

  // The personal financial log, where ensurePersonalLedger would put it.
  const ledgerRef = doc(db, "ledgers", `personal-${uid}`);
  await setDoc(ledgerRef, {
    title: "My spending",
    max_participants: 1,
    defaultCurrency: CURRENCY,
    members: [userRef],
    memberUids: [uid],
    createdBy: uid,
    categories,
    createdAt: serverTimestamp(),
  });
  await updateDoc(userRef, { personalLedgerId: ledgerRef.id });
  for (const entry of ENTRIES) {
    await addDoc(collection(ledgerRef, "entries"), {
      amount: entry.amount,
      currency: CURRENCY,
      categoryId: entry.categoryId,
      date: dateThisMonth(entry.day),
      month: thisMonth,
      ...(entry.note ? { note: entry.note } : {}),
      author: userRef,
      authorUid: uid,
      authorName: "Robin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log(`✅ personal log with ${ENTRIES.length} entries`);

  // An ongoing log group: started two days ago, ends in five.
  const startWallClock = wallClock(NOW - 2 * DAY);
  const endWallClock = wallClock(NOW + 5 * DAY);
  const groupRef = await addDoc(collection(db, "log_groups"), {
    title: "Island weekend",
    members: [userRef],
    createdBy: uid,
    max_participants: 10,
    startWallClock,
    endWallClock,
    start: Timestamp.fromDate(new Date(startWallClock)),
    end: Timestamp.fromDate(new Date(endWallClock)),
    createdAt: Timestamp.fromMillis(NOW - 3 * DAY),
  });
  await updateDoc(userRef, { groups: [groupRef.id] });
  for (const post of POSTS) {
    const at = Timestamp.fromMillis(NOW - post.daysAgo * DAY);
    await addDoc(collection(db, "log_posts"), {
      content: post.content,
      amount: post.amount,
      currency: CURRENCY,
      author: userRef,
      authorName: "Robin",
      group: groupRef,
      groupName: "Island weekend",
      postDate: at,
      createdAt: at,
      commentSubscribers: [userRef],
    });
  }
  console.log(`✅ log group with ${POSTS.length} posts`);

  console.log("\n🎉 Done. Put the email and password in the review notes.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding the review account failed:", error);
  process.exit(1);
});
