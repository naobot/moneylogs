// scripts/seed-emulator.ts
//
// Fills a fresh emulator session with users, social logs at every stage of their life,
// financial logs with budgets, and a notification inbox. Run it once per emulator
// session (`firebase emulators:start`, then `npm run seed-emulator`).
//
// Writes go through the client SDK as the acting user, so the security rules are
// exercised the same way the app exercises them. Derived data comes from the Cloud
// Functions emulator, as in production: post/comment metadata, ledger month summaries,
// and comment, reaction and budget notifications. The two things functions can't produce
// here are written directly with emulator owner access: the hourly "ending soon / has
// ended" notifications (scheduled functions don't fire in the emulator) and the
// "you started / joined a log" ones the app writes at the moment of the action.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  DocumentReference,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { timelineNotificationsFor } from "../functions/src/logTimeline";
import { PRESET_AVATARS } from "../src/features/account/avatar/presets";
import {
  APP_URL,
  PASSWORD,
  auth,
  db,
  functions,
  functionsEmulatorIsUp,
  docPath,
  markEmailVerified,
  ownerWrite,
  type Value,
} from "./emulator";
import { PERSONAS, PERSONA_KEYS, resetPersona } from "./personas";

/** A premade avatar's grid by id (not position, which changes as presets are added). */
const presetGrid = (id: string): string[] => {
  const preset = PRESET_AVATARS.find((p) => p.id === id);
  if (!preset) throw new Error(`No preset avatar "${id}"`);
  return [...preset.grid];
};

// This script runs under tsx (Node); `process` is provided by the runtime but
// this file is outside the app tsconfig, so declare the bit we use.
declare const process: { exit(code?: number): never };

// ---------------------------------------------------------------------------
// Time helpers. "Wall clock" strings are timezone-agnostic, like the ones the create
// wizard stores: each member's own timezone decides when the log starts and ends.
// ---------------------------------------------------------------------------
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

const wallClock = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const daysAgo = (days: number) => new Date(NOW - days * DAY);

/** "YYYY-MM-DD" for an instant in a timezone. */
const dateKeyIn = (timeZone: string, ms: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));

const previousMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Users. Alice is the main account to sign in as: she has something in every state.
// Every password is test123.
// ---------------------------------------------------------------------------

const testUsers = [
  {
    key: "alice",
    email: "alice.vancouver@test.com",
    displayName: "Alice Chen",
    location: "Vancouver",
    timezone: "America/Vancouver",
    currency: "CAD",
  },
  {
    key: "bob",
    email: "bob.nyc@test.com",
    displayName: "Bob Rodriguez",
    location: "New York",
    timezone: "America/New_York",
    currency: "USD",
  },
  {
    key: "charlie",
    email: "charlie.london@test.com",
    displayName: "Charlie Williams",
    location: "London",
    timezone: "Europe/London",
    currency: "GBP",
  },
  {
    key: "diana",
    email: "diana.berlin@test.com",
    displayName: "Diana Mueller",
    location: "Berlin",
    timezone: "Europe/Berlin",
    currency: "EUR",
  },
  {
    key: "erik",
    email: "erik.tokyo@test.com",
    displayName: "Erik Tanaka",
    location: "Tokyo",
    timezone: "Asia/Tokyo",
    currency: "JPY",
  },
  {
    key: "fiona",
    email: "fiona.singapore@test.com",
    displayName: "Fiona Lim",
    location: "Singapore",
    timezone: "Asia/Singapore",
    currency: "SGD",
  },
] as const;

type UserKey = (typeof testUsers)[number]["key"];
type SeededUser = (typeof testUsers)[number] & { uid: string; docId: string };

const users = {} as Record<UserKey, SeededUser>;
const userRef = (key: UserKey) => doc(db, "users", users[key].docId);
const userPath = (key: UserKey) => docPath(`users/${users[key].docId}`);

const signInAs = (key: UserKey) => signInWithEmailAndPassword(auth, users[key].email, PASSWORD);

// ---------------------------------------------------------------------------
// Social logs, one for each state the home dashboard and /me tell apart.
// ---------------------------------------------------------------------------
type GroupSeed = {
  key: string;
  title: string;
  /** undefined: like logs from before createdBy existed (exercises the backfill script). */
  creator?: UserKey;
  members: UserKey[];
  startMs: number;
  endMs: number;
};

const testGroups: GroupSeed[] = [
  {
    key: "roommates",
    title: "Roommates - Vancouver House",
    creator: "alice",
    members: ["alice", "bob", "charlie", "diana"],
    startMs: NOW - 30 * DAY,
    endMs: NOW + 30 * DAY,
  },
  {
    // Ends about 9–18 hours from now in each member's own zone: "ending soon".
    key: "asia",
    title: "Asia Trip 2025",
    members: ["charlie", "diana", "erik", "fiona"],
    startMs: NOW - 14 * DAY,
    endMs: NOW + 18 * HOUR,
  },
  {
    // Ended 10–13 hours ago for Alice and Bob, and the summary is unlocked for
    // everyone: "has ended".
    key: "whistler",
    title: "Whistler Weekend",
    creator: "bob",
    members: ["alice", "bob"],
    startMs: NOW - 3 * DAY,
    endMs: NOW - 18 * HOUR,
  },
  {
    key: "lisbon",
    title: "Lisbon Workation",
    creator: "charlie",
    members: ["alice", "charlie", "diana"],
    startMs: NOW - 75 * DAY,
    endMs: NOW - 60 * DAY,
  },
  {
    key: "toronto",
    title: "Toronto Conference",
    creator: "alice",
    members: ["alice", "bob"],
    startMs: NOW - 125 * DAY,
    endMs: NOW - 120 * DAY,
  },
  {
    // A fourth past log, so home's "3 most recent" hands the rest off to /me.
    key: "montreal",
    title: "Montreal Jazz Fest",
    creator: "alice",
    members: ["alice", "charlie"],
    startMs: NOW - 155 * DAY,
    endMs: NOW - 150 * DAY,
  },
  {
    // Archived by Alice (see ALICE_EXTRAS).
    key: "ski",
    title: "Ski Trip",
    creator: "bob",
    members: ["alice", "bob"],
    startMs: NOW - 210 * DAY,
    endMs: NOW - 200 * DAY,
  },
  {
    key: "kyoto",
    title: "Kyoto in Spring",
    creator: "erik",
    members: ["alice", "erik"],
    startMs: NOW + 20 * DAY,
    endMs: NOW + 27 * DAY,
  },
  {
    // Erik's alone in this one: deleting his account purges it, while his posts in
    // "Asia Trip 2025" stay behind as a "deleted user".
    key: "tokyoSolo",
    title: "Tokyo Solo Week",
    creator: "erik",
    members: ["erik"],
    startMs: NOW - 5 * DAY,
    endMs: NOW + 9 * DAY,
  },
];

type PostSeed = {
  key: string;
  group: string;
  author: UserKey;
  daysAgo: number;
  content: string;
  amount: number;
  currency: string;
};

const samplePosts: PostSeed[] = [
  // Roommates. Alice last looked 3 days ago, so the last three count as new on her card.
  {
    key: "groceries",
    group: "roommates",
    author: "alice",
    daysAgo: 4,
    content: "Groceries for the week",
    amount: 85.5,
    currency: "CAD",
  },
  {
    key: "utilities",
    group: "roommates",
    author: "bob",
    daysAgo: 5,
    content: "Utilities bill - electricity",
    amount: 120,
    currency: "USD",
  },
  {
    key: "internet",
    group: "roommates",
    author: "charlie",
    daysAgo: 7,
    content: "Internet bill",
    amount: 45.99,
    currency: "GBP",
  },
  {
    key: "cleaning",
    group: "roommates",
    author: "diana",
    daysAgo: 1,
    content: "Cleaning supplies",
    amount: 32.75,
    currency: "EUR",
  },
  {
    key: "bike",
    group: "roommates",
    author: "charlie",
    daysAgo: 2,
    content: "Bike repair 🚲",
    amount: 40,
    currency: "GBP",
  },
  {
    key: "pizza",
    group: "roommates",
    author: "bob",
    daysAgo: 0.25,
    content: "Pizza night for the house 🍕",
    amount: 64.2,
    currency: "USD",
  },
  // Asia trip
  {
    key: "flight",
    group: "asia",
    author: "fiona",
    daysAgo: 13,
    content: "Flight to Singapore",
    amount: 450,
    currency: "SGD",
  },
  {
    key: "hotel",
    group: "asia",
    author: "erik",
    daysAgo: 10,
    content: "Tokyo hotel booking",
    amount: 15000,
    currency: "JPY",
  },
  {
    key: "train",
    group: "asia",
    author: "diana",
    daysAgo: 8,
    content: "Train tickets in Europe",
    amount: 89.5,
    currency: "EUR",
  },
  {
    key: "dinner",
    group: "asia",
    author: "charlie",
    daysAgo: 3,
    content: "Restaurant dinner in London",
    amount: 125.8,
    currency: "GBP",
  },
  {
    key: "ramen",
    group: "asia",
    author: "erik",
    daysAgo: 1,
    content: "Late-night ramen 🍜",
    amount: 1400,
    currency: "JPY",
  },
  // Whistler
  {
    key: "liftPass",
    group: "whistler",
    author: "alice",
    daysAgo: 2.5,
    content: "Lift passes x2",
    amount: 398,
    currency: "CAD",
  },
  {
    key: "fondue",
    group: "whistler",
    author: "bob",
    daysAgo: 1.5,
    content: "Fondue dinner",
    amount: 142,
    currency: "CAD",
  },
  // Lisbon
  {
    key: "cowork",
    group: "lisbon",
    author: "charlie",
    daysAgo: 74,
    content: "Co-working pass, two weeks",
    amount: 180,
    currency: "EUR",
  },
  {
    key: "pasteis",
    group: "lisbon",
    author: "alice",
    daysAgo: 70,
    content: "Pastéis de nata, purely for research",
    amount: 9.6,
    currency: "EUR",
  },
  {
    key: "tram",
    group: "lisbon",
    author: "diana",
    daysAgo: 66,
    content: "Tram 28 and a castle ticket",
    amount: 21,
    currency: "EUR",
  },
  {
    key: "sardines",
    group: "lisbon",
    author: "alice",
    daysAgo: 62,
    content: "Farewell sardine feast",
    amount: 96.4,
    currency: "EUR",
  },
  // Older past logs
  {
    key: "badge",
    group: "toronto",
    author: "alice",
    daysAgo: 124,
    content: "Conference badge",
    amount: 349,
    currency: "CAD",
  },
  {
    key: "uber",
    group: "toronto",
    author: "bob",
    daysAgo: 122,
    content: "Ride to the venue",
    amount: 28.5,
    currency: "CAD",
  },
  {
    key: "tickets",
    group: "montreal",
    author: "charlie",
    daysAgo: 153,
    content: "Festival tickets",
    amount: 210,
    currency: "CAD",
  },
  {
    key: "bagels",
    group: "montreal",
    author: "alice",
    daysAgo: 151,
    content: "St-Viateur bagels, a dozen",
    amount: 18,
    currency: "CAD",
  },
  {
    key: "rentals",
    group: "ski",
    author: "bob",
    daysAgo: 208,
    content: "Ski rentals",
    amount: 160,
    currency: "CAD",
  },
  // Erik's solo log
  {
    key: "sento",
    group: "tokyoSolo",
    author: "erik",
    daysAgo: 4,
    content: "Sento and a cold milk",
    amount: 650,
    currency: "JPY",
  },
  {
    key: "records",
    group: "tokyoSolo",
    author: "erik",
    daysAgo: 2,
    content: "Record shop haul",
    amount: 8200,
    currency: "JPY",
  },
];

const sampleComments: { post: string; author: UserKey; content: string }[] = [
  { post: "groceries", author: "bob", content: "Thanks for getting these! 🛒" },
  { post: "utilities", author: "charlie", content: "Can we split this evenly?" },
  { post: "utilities", author: "alice", content: "Yes, I'll e-transfer you tonight" },
  { post: "pizza", author: "diana", content: "Save me a slice!!" },
  { post: "hotel", author: "fiona", content: "Perfect timing on the hotel booking!" },
  { post: "dinner", author: "erik", content: "Great choice of restaurant 👍" },
  { post: "sardines", author: "charlie", content: "Best night of the trip" },
  { post: "liftPass", author: "bob", content: "Worth every cent" },
];

// reactions.{userDocId}: the distinct emoji that user added
const sampleReactions: { post: string; by: UserKey; emoji: string[] }[] = [
  { post: "groceries", by: "bob", emoji: ["🔥", "👍"] },
  { post: "groceries", by: "diana", emoji: ["👍"] },
  { post: "utilities", by: "alice", emoji: ["💸"] },
  { post: "pizza", by: "alice", emoji: ["😂", "🔥"] },
  { post: "pizza", by: "charlie", emoji: ["🔥"] },
  { post: "hotel", by: "charlie", emoji: ["👀"] },
  { post: "sardines", by: "charlie", emoji: ["🔥"] },
  { post: "sardines", by: "diana", emoji: ["🔥", "😂"] },
  { post: "liftPass", by: "bob", emoji: ["💸"] },
];

// ---------------------------------------------------------------------------
// Financial logs. Everyone gets a "personal" ledger, as the app makes on first load.
// Alice's personal and shared ledgers carry budgets in different states.
// ---------------------------------------------------------------------------
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

const categoriesWithBudgets = (
  currency: string,
  budgets: Record<string, number> = {},
  names: ReadonlyArray<string> = CATEGORY_NAMES,
) =>
  names.map((name, order) => {
    const id = name.toLowerCase();
    return {
      id,
      name,
      order,
      ...(budgets[id] ? { budget: { [currency]: budgets[id] } } : {}),
    };
  });

type LedgerSeed = {
  key: string;
  owner: UserKey;
  /** Personal ledgers live at personal-<uid>, as ensurePersonalLedger makes them. */
  personal?: boolean;
  title: string;
  maxParticipants: number;
  joiners: UserKey[];
  budgets?: Record<string, number>;
  /** Its own category names, instead of the app's ten defaults. */
  categories?: string[];
  /** Its default currency, if not the owner's. */
  currency?: string;
};

const testLedgers: LedgerSeed[] = [
  ...testUsers.map((u): LedgerSeed => ({
    key: `personal:${u.key}`,
    owner: u.key,
    personal: true,
    title: "personal",
    maxParticipants: 1,
    joiners: [],
    // Groceries over budget, entertainment approaching, the total on pace to go over.
    budgets:
      u.key === "alice"
        ? { food: 300, groceries: 250, transport: 120, entertainment: 100 }
        : undefined,
  })),
  {
    key: "home",
    owner: "alice",
    title: "Alice + Bob home",
    maxParticipants: 4,
    joiners: ["bob"],
    // Housing nearly spent, so the month's total is "approaching" (80%+).
    budgets: { housing: 1900, utilities: 150, groceries: 300 },
  },
  // Sublogs (linkSublogs below): Alice's side business counts as one line in her
  // personal log, all its months; the trip she shares with Bob counts there from this
  // month, and only her share, since Bob isn't in her personal log.
  {
    key: "business",
    owner: "alice",
    title: "business",
    maxParticipants: 1,
    joiners: [],
    categories: ["Software", "Travel", "Supplies"],
    budgets: { software: 300, travel: 200 },
  },
  {
    key: "bali",
    owner: "alice",
    title: "bali 2026",
    maxParticipants: 4,
    joiners: ["bob"],
    currency: "USD",
  },
];

type EntrySeed = {
  ledger: string;
  author: UserKey;
  /** Day of this month (clamped to today), or of last month with lastMonth. */
  day: number;
  lastMonth?: boolean;
  amount: number;
  currency: string;
  categoryId: string;
  note?: string;
};

const sampleEntries: EntrySeed[] = [
  // Alice personal, this month
  {
    ledger: "personal:alice",
    author: "alice",
    day: 1,
    amount: 82.3,
    currency: "CAD",
    categoryId: "groceries",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 2,
    amount: 42,
    currency: "CAD",
    categoryId: "food",
    note: "Dim sum",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 3,
    amount: 3.15,
    currency: "CAD",
    categoryId: "transport",
    note: "Bus",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 5,
    amount: 96.1,
    currency: "CAD",
    categoryId: "groceries",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 6,
    amount: 61.2,
    currency: "CAD",
    categoryId: "food",
    note: "Birthday dinner",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 7,
    amount: 85,
    currency: "CAD",
    categoryId: "entertainment",
    note: "Concert",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 8,
    amount: 1200,
    currency: "JPY",
    categoryId: "food",
    note: "Onigiri haul",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 9,
    amount: 22.5,
    currency: "CAD",
    categoryId: "transport",
    note: "Compass top-up",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 10,
    amount: 88.6,
    currency: "CAD",
    categoryId: "groceries",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 12,
    amount: 38.75,
    currency: "CAD",
    categoryId: "food",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 31,
    amount: 14.5,
    currency: "CAD",
    categoryId: "food",
    note: "Ramen",
  },
  // Alice personal, last month
  {
    ledger: "personal:alice",
    author: "alice",
    day: 4,
    lastMonth: true,
    amount: 210,
    currency: "CAD",
    categoryId: "groceries",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 11,
    lastMonth: true,
    amount: 120,
    currency: "CAD",
    categoryId: "food",
  },
  {
    ledger: "personal:alice",
    author: "alice",
    day: 20,
    lastMonth: true,
    amount: 64.99,
    currency: "CAD",
    categoryId: "shopping",
    note: "Rain jacket",
  },
  // Erik personal
  {
    ledger: "personal:erik",
    author: "erik",
    day: 3,
    amount: 980,
    currency: "JPY",
    categoryId: "food",
    note: "Katsu curry",
  },
  {
    ledger: "personal:erik",
    author: "erik",
    day: 9,
    amount: 5400,
    currency: "JPY",
    categoryId: "groceries",
  },
  // Alice's business (a sublog of her personal log, all months)
  {
    ledger: "business",
    author: "alice",
    day: 3,
    amount: 42,
    currency: "CAD",
    categoryId: "software",
    note: "Domain renewal",
  },
  {
    ledger: "business",
    author: "alice",
    day: 9,
    amount: 150,
    currency: "CAD",
    categoryId: "travel",
  },
  {
    ledger: "business",
    author: "alice",
    day: 12,
    amount: 70,
    currency: "CAD",
    categoryId: "supplies",
  },
  {
    ledger: "business",
    author: "alice",
    day: 14,
    lastMonth: true,
    amount: 168,
    currency: "CAD",
    categoryId: "software",
    note: "Design tool, yearly",
  },
  // bali 2026, Alice + Bob (a sublog of Alice's personal log: only her entries count)
  { ledger: "bali", author: "alice", day: 2, amount: 120, currency: "USD", categoryId: "food" },
  {
    ledger: "bali",
    author: "alice",
    day: 2,
    amount: 300,
    currency: "USD",
    categoryId: "travel",
    note: "Villa, her half",
  },
  {
    ledger: "bali",
    author: "bob",
    day: 2,
    amount: 300,
    currency: "USD",
    categoryId: "travel",
    note: "Villa, his half",
  },
  { ledger: "bali", author: "bob", day: 5, amount: 80, currency: "USD", categoryId: "food" },
  // Shared home ledger
  {
    ledger: "home",
    author: "alice",
    day: 1,
    amount: 1850,
    currency: "CAD",
    categoryId: "housing",
    note: "Rent",
  },
  {
    ledger: "home",
    author: "bob",
    day: 4,
    amount: 96.4,
    currency: "CAD",
    categoryId: "utilities",
    note: "Hydro",
  },
  {
    ledger: "home",
    author: "bob",
    day: 11,
    amount: 120,
    currency: "USD",
    categoryId: "groceries",
    note: "Costco run in Bellingham",
  },
  { ledger: "home", author: "bob", day: 31, amount: 64, currency: "CAD", categoryId: "groceries" },
  {
    ledger: "home",
    author: "alice",
    day: 1,
    lastMonth: true,
    amount: 1850,
    currency: "CAD",
    categoryId: "housing",
    note: "Rent",
  },
  {
    ledger: "home",
    author: "bob",
    day: 6,
    lastMonth: true,
    amount: 88.1,
    currency: "CAD",
    categoryId: "utilities",
    note: "Hydro",
  },
];

const notify = (userKey: UserKey, id: string, data: { [key: string]: Value }) =>
  ownerWrite(`users/${users[userKey].docId}/notifications/${id}`, data);

// ---------------------------------------------------------------------------
// Seeding steps
// ---------------------------------------------------------------------------
async function createUsers() {
  for (const info of testUsers) {
    let uid: string;
    try {
      ({
        user: { uid },
      } = await createUserWithEmailAndPassword(auth, info.email, PASSWORD));
    } catch (error) {
      if ((error as { code?: string })?.code === "auth/email-already-in-use") {
        throw new Error(
          "The emulator is already seeded. Restart the emulators for a clean slate, then seed again.",
        );
      }
      throw error;
    }
    // Long-time users: they confirmed their email long ago.
    await markEmailVerified(uid);
    // Like registration: a random doc id, with the auth uid in `userId`. Doc ids and
    // uids differ in production, so they differ here too.
    const ref = await addDoc(collection(db, "users"), {
      userId: uid,
      email: info.email,
      displayName: info.displayName,
      displayLocation: info.location,
      timezone: info.timezone,
      // A couple of users have drawn avatars; the rest show their initial.
      ...(info.key === "alice"
        ? { avatar: presetGrid("smile") }
        : info.key === "erik"
          ? { avatar: presetGrid("cat") }
          : info.key === "bob"
            ? { avatar: presetGrid("dog") }
            : {}),
      createdAt: serverTimestamp(),
      groups: [],
    });
    users[info.key] = { ...info, uid, docId: ref.id };
    console.log(`✅ ${info.displayName} (${info.email})`);
  }
}

/** Made a couple of days before it starts, or a few days ago for upcoming logs. */
const createdAtMs = (group: GroupSeed) => Math.min(group.startMs - 2 * DAY, NOW - 3 * DAY);

const groupsOf = new Map<UserKey, string[]>();

async function createGroups() {
  const ids: Record<string, string> = {};
  // Oldest first, so each user's `groups` ends up newest-first, as the app keeps it.
  const byStart = [...testGroups].sort((a, b) => a.startMs - b.startMs);
  for (const group of byStart) {
    const members = group.members.map(userPath);
    const creator = group.creator ? userPath(group.creator) : undefined;
    const startWallClock = wallClock(group.startMs);
    const endWallClock = wallClock(group.endMs);
    // Owner write: the rules only let a client create a log with themselves in it, at
    // the current time. Seeded logs start full and backdated.
    const id = doc(collection(db, "log_groups")).id;
    await ownerWrite(`log_groups/${id}`, {
      title: group.title,
      // The app prepends joiners, so the creator ends up last; mirror that.
      members: creator ? [...members.filter((m) => m.path !== creator.path), creator] : members,
      createdBy: group.creator ? users[group.creator].uid : undefined,
      max_participants: 10,
      startWallClock,
      endWallClock,
      // As the app stores them: the wall clock read in the creating machine's zone.
      start: new Date(startWallClock),
      end: new Date(endWallClock),
      createdAt: new Date(createdAtMs(group)),
    });
    ids[group.key] = id;
    for (const member of group.members) {
      const existing = groupsOf.get(member) ?? [];
      groupsOf.set(member, [id, ...existing]);
    }
    console.log(`✅ ${group.title}`);
  }
  // User docs are private to their owner, so each member writes their own list.
  for (const [member, groups] of groupsOf) {
    await signInAs(member);
    await updateDoc(userRef(member), { groups });
  }
  return ids;
}

async function createPosts(groupIds: Record<string, string>) {
  // Owner writes, like the logs: posts are backdated, and each one is written whole with
  // the comment subscribers and reactions the comments and reactions below add up to.
  const ids = Object.fromEntries(
    samplePosts.map((post) => [post.key, doc(collection(db, "log_posts")).id]),
  );
  for (const post of samplePosts) {
    const author = users[post.author];
    const group = testGroups.find((g) => g.key === post.group)!;
    const comments = sampleComments.filter((c) => c.post === post.key);
    const subscribers = [...new Set([post.author, ...comments.map((c) => c.author)])];
    const reactions = sampleReactions.filter((r) => r.post === post.key);
    await ownerWrite(`log_posts/${ids[post.key]}`, {
      content: post.content,
      amount: post.amount,
      currency: post.currency,
      author: userPath(post.author),
      authorName: author.displayName,
      group: docPath(`log_groups/${groupIds[post.group]}`),
      groupName: group.title,
      postDate: daysAgo(post.daysAgo),
      createdAt: daysAgo(post.daysAgo),
      commentSubscribers: subscribers.map(userPath),
      commentCount: comments.length || undefined,
      reactions: reactions.length
        ? Object.fromEntries(reactions.map((r) => [users[r.by].docId, r.emoji]))
        : undefined,
    });
  }
  console.log(`✅ ${samplePosts.length} posts`);

  for (const comment of sampleComments) {
    await ownerWrite(`log_posts/${ids[comment.post]}/comments/${doc(collection(db, "x")).id}`, {
      content: comment.content,
      authorId: userPath(comment.author),
      authorName: users[comment.author].displayName,
      createdAt: new Date(),
    });
  }
  console.log(`💬 ${sampleComments.length} comments`);
  console.log(`🔥 ${sampleReactions.length} reactions`);
  return ids;
}

async function createLedgers() {
  const ids: Record<string, string> = {};
  for (const ledger of testLedgers) {
    const owner = users[ledger.owner];
    await signInAs(ledger.owner);
    const data = {
      title: ledger.title,
      max_participants: ledger.maxParticipants,
      defaultCurrency: ledger.currency ?? owner.currency,
      members: [userRef(ledger.owner)],
      memberUids: [owner.uid],
      createdBy: owner.uid,
      categories: categoriesWithBudgets(
        ledger.currency ?? owner.currency,
        ledger.budgets,
        ledger.categories,
      ),
      createdAt: serverTimestamp(),
    };
    let ref: DocumentReference;
    if (ledger.personal) {
      ref = doc(db, "ledgers", `personal-${owner.uid}`);
      await setDoc(ref, data);
      // The marker that stops the app making another one.
      await updateDoc(userRef(ledger.owner), { personalLedgerId: ref.id });
    } else {
      ref = await addDoc(collection(db, "ledgers"), data);
    }
    for (const joiner of ledger.joiners) {
      await signInAs(joiner);
      await updateDoc(ref, {
        members: arrayUnion(userRef(joiner)),
        memberUids: arrayUnion(users[joiner].uid),
      });
    }
    ids[ledger.key] = ref.id;
  }
  console.log(
    `✅ ${testLedgers.length} financial logs (one personal log each, a shared one, two sublogs)`,
  );

  for (const entry of sampleEntries) {
    const author = users[entry.author];
    const today = dateKeyIn(author.timezone, NOW);
    const thisMonth = today.slice(0, 7);
    const month = entry.lastMonth ? previousMonth(thisMonth) : thisMonth;
    // This month's entries never land in the future; last month's stay inside it.
    const lastDay = entry.lastMonth ? 28 : Number(today.slice(8));
    const day = String(Math.min(entry.day, lastDay)).padStart(2, "0");
    await signInAs(entry.author);
    await addDoc(collection(db, "ledgers", ids[entry.ledger], "entries"), {
      amount: entry.amount,
      currency: entry.currency,
      categoryId: entry.categoryId,
      date: `${month}-${day}`,
      month,
      ...(entry.note ? { note: entry.note } : {}),
      author: userRef(entry.author),
      authorUid: author.uid,
      authorName: author.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log(`✅ ${sampleEntries.length} financial entries`);
  return ids;
}

/**
 * Make Alice's business and trip logs sublogs of her personal log, through the real
 * linkSublog function, which builds the roll-ups. Needs the Functions emulator.
 */
async function linkSublogs(ledgerIds: Record<string, string>) {
  if (!(await functionsEmulatorIsUp())) {
    console.warn("⚠️  Functions emulator down: sublogs left unlinked");
    return;
  }
  const link = httpsCallable(functions, "linkSublog");
  const alice = users.alice;
  const thisMonth = dateKeyIn(alice.timezone, NOW).slice(0, 7);
  await signInAs("alice");
  const personal = ledgerIds["personal:alice"];
  // Every month of business, so last month's personal stats include it too.
  await link({ childId: ledgerIds.business, parentId: personal, since: "1970-01" });
  await link({ childId: ledgerIds.bali, parentId: personal, name: "bali", since: thisMonth });
  console.log("🔗 business and bali 2026 count in Alice's personal log");
}

/** Alice's own view: last visits (for "new" badges), a pin, an archived log, prefs. */
async function personaliseAlice(
  groupIds: Record<string, string>,
  postIds: Record<string, string>,
  ledgerIds: Record<string, string>,
) {
  await signInAs("alice");
  await updateDoc(userRef("alice"), {
    [`logLastViewedAt.${groupIds.roommates}`]: Timestamp.fromDate(daysAgo(3)),
    [`logLastViewedAt.${ledgerIds.home}`]: Timestamp.fromDate(daysAgo(5)),
    [`pinnedPosts.${groupIds.roommates}.pinnedPost`]: postIds.utilities,
    [`archivedLogs.${groupIds.ski}`]: Timestamp.fromDate(daysAgo(150)),
    // Category budget alerts are off by default; Alice opts in.
    "notificationPrefs.budget_category": true,
  });
  console.log("✅ Alice's visits, pin, archive and notification prefs");
}

/**
 * Alice's personal invite link, at a fixed code so the link is the same every session
 * (and in docs/user-states.md). Like getInviteCode: invites/{code} plus the user doc.
 */
const ALICE_INVITE_CODE = "alice-0001";

async function createInvites() {
  await ownerWrite(`invites/${ALICE_INVITE_CODE}`, {
    inviterId: users.alice.docId,
    createdAt: new Date(NOW - 20 * DAY),
  });
  await ownerWrite(
    `users/${users.alice.docId}`,
    { inviteCode: ALICE_INVITE_CODE },
    { merge: true },
  );
  console.log(`✅ Alice's invite link (${ALICE_INVITE_CODE})`);
}

async function createPersonas() {
  for (const key of PERSONA_KEYS) {
    await resetPersona(key);
    console.log(`✅ ${key}: ${PERSONAS[key].email}, ${PERSONAS[key].stage}`);
  }
}

async function writeNotifications(
  groupIds: Record<string, string>,
  ledgerIds: Record<string, string>,
) {
  let count = 0;

  // "You started / joined a log", which the app writes as it happens.
  for (const group of testGroups) {
    for (const member of group.members) {
      const type = member === group.creator ? "log_created" : "log_joined";
      const at = new Date(createdAtMs(group));
      await notify(member, `${type}_${groupIds[group.key]}`, {
        type,
        groupId: groupIds[group.key],
        groupName: group.title,
        logKind: "social",
        createdAt: at,
        // Anything older than a week has been seen.
        readAt: NOW - at.getTime() > 7 * DAY ? at : null,
      });
      count++;
    }
  }
  for (const ledger of testLedgers.filter((l) => !l.personal)) {
    for (const member of [ledger.owner, ...ledger.joiners]) {
      const type = member === ledger.owner ? "log_created" : "log_joined";
      await notify(member, `${type}_${ledgerIds[ledger.key]}`, {
        type,
        groupId: ledgerIds[ledger.key],
        groupName: ledger.title,
        logKind: "ledger",
        createdAt: daysAgo(40),
        readAt: daysAgo(40),
      });
      count++;
    }
  }

  // "Ending soon" and "has ended", exactly as the hourly notifyLogTimeline job would.
  for (const group of testGroups) {
    for (const member of group.members) {
      const due = timelineNotificationsFor(
        {
          id: groupIds[group.key],
          title: group.title,
          endWallClock: wallClock(group.endMs),
          endMs: new Date(wallClock(group.endMs)).getTime(),
        },
        { timezone: users[member].timezone },
        NOW,
      );
      for (const n of due) {
        await notify(member, n.id, {
          ...n.data,
          createdAt: new Date(NOW - HOUR),
          readAt: null,
        });
        count++;
      }
    }
  }
  console.log(`🔔 ${count} membership and timeline notifications`);
}

async function seedEmulator() {
  console.log("🌱 Seeding the emulators...");
  try {
    console.log("\n👥 Users");
    await createUsers();

    console.log("\n📁 Social logs");
    const groupIds = await createGroups();

    console.log("\n📝 Posts, comments and reactions");
    const postIds = await createPosts(groupIds);

    console.log("\n💰 Financial logs");
    const ledgerIds = await createLedgers();
    await linkSublogs(ledgerIds);

    console.log("\n👤 Personal touches");
    await personaliseAlice(groupIds, postIds, ledgerIds);

    console.log("\n🔔 Notifications");
    await writeNotifications(groupIds, ledgerIds);

    console.log("\n✉️  Invites");
    await createInvites();

    console.log("\n🐣 New-user personas (reset any time: npm run reset-persona -- <name|all>)");
    await createPersonas();

    console.log("\n🎉 Done. Sign in as alice.vancouver@test.com / test123 to see:");
    console.log(
      "   - home: an ongoing log with new posts, an upcoming one, the 3 latest past logs",
    );
    console.log("   - /me: a 4th past log and an archived one");
    console.log("   - /notifications: joins, a log that just ended, comments, reactions, budgets");
    console.log("   - financial: a personal log over budget in places, a shared one near budget");
    console.log(
      "   - sublogs: business and bali 2026 (shared with Bob) as lines in her personal log",
    );
    console.log("   Charlie (charlie.london@test.com) sees a log that's ending soon.");
    console.log("   Erik (erik.tokyo@test.com) is good for trying account deletion: one solo");
    console.log('   log to purge, one shared log where his posts become a "deleted user".');
    console.log("\n🐣 New users (same password): fresh@, empty@, lapsed@test.com. Invite links to");
    console.log("   sign up or join through (docs/user-states.md has the flows to walk):");
    console.log(`   - friend: ${APP_URL}/invite/${ALICE_INVITE_CODE}`);
    console.log(`   - social log: ${APP_URL}/g/${groupIds.roommates}/invite`);
    console.log(`   - financial log: ${APP_URL}/l/${ledgerIds.home}/invite`);

    if (!(await functionsEmulatorIsUp())) {
      console.warn(
        "\n⚠️  The Functions emulator isn't answering on :5001, so ledger month totals, budget " +
          "alerts and comment/reaction notifications weren't generated. Build the functions " +
          "(cd functions && npm run build), restart the emulators and seed again.",
      );
    }
    console.log("\n🔗 Emulator UI: http://127.0.0.1:1331/");
  } catch (error) {
    console.error("❌ Error seeding emulator:", error);
    process.exit(1);
  }
  process.exit(0);
}

void seedEmulator();
