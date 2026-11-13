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
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
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
import { timelineNotificationsFor } from "../functions/src/logTimeline";

// This script runs under tsx (Node); `process` is provided by the runtime but
// this file is outside the app tsconfig, so declare the bit we use.
declare const process: { exit(code?: number): never };

const PROJECT_ID = "moneylogs-89ebf";
const FIRESTORE_HOST = "localhost:8888";
const FUNCTIONS_URL = "http://localhost:5001";

const app = initializeApp({
  apiKey: "mock-api-key",
  authDomain: "mock-auth-domain",
  projectId: PROJECT_ID,
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id",
});
const auth = getAuth(app);
const db = getFirestore(app);

try {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8888);
} catch {
  console.log("Emulators already connected or not running");
}

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
const PASSWORD = "test123";

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

const categoriesWithBudgets = (currency: string, budgets: Record<string, number> = {}) =>
  CATEGORY_NAMES.map((name, order) => {
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

// ---------------------------------------------------------------------------
// Owner writes (bypass rules) for what only backend jobs or the acting client write.
// ---------------------------------------------------------------------------
type Value =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Value[]
  | { [key: string]: Value };

const encode = (v: Value): unknown => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v) } };
};
// Undefined fields are left out, as the Admin SDK's ignoreUndefinedProperties would.
const encodeFields = (data: { [key: string]: Value }) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, encode(v)]),
  );

async function ownerWrite(path: string, data: { [key: string]: Value }) {
  const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`Owner write to ${path} failed: ${res.status} ${await res.text()}`);
}

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
    // Like registration: a random doc id, with the auth uid in `userId`. Doc ids and
    // uids differ in production, so they differ here too.
    const ref = await addDoc(collection(db, "users"), {
      userId: uid,
      email: info.email,
      displayName: info.displayName,
      displayLocation: info.location,
      timezone: info.timezone,
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
    const members = group.members.map(userRef);
    const creatorRef = group.creator ? userRef(group.creator) : undefined;
    const startWallClock = wallClock(group.startMs);
    const endWallClock = wallClock(group.endMs);
    const ref = await addDoc(collection(db, "log_groups"), {
      title: group.title,
      // The app prepends joiners, so the creator ends up last; mirror that.
      members: creatorRef
        ? [...members.filter((m) => m.id !== creatorRef.id), creatorRef]
        : members,
      ...(group.creator ? { createdBy: users[group.creator].uid } : {}),
      max_participants: 10,
      startWallClock,
      endWallClock,
      // As the app stores them: the wall clock read in the creating machine's zone.
      start: Timestamp.fromDate(new Date(startWallClock)),
      end: Timestamp.fromDate(new Date(endWallClock)),
      createdAt: Timestamp.fromMillis(createdAtMs(group)),
    });
    ids[group.key] = ref.id;
    for (const member of group.members) {
      const existing = groupsOf.get(member) ?? [];
      groupsOf.set(member, [ref.id, ...existing]);
    }
    console.log(`✅ ${group.title}`);
  }
  for (const [member, groups] of groupsOf) {
    await updateDoc(userRef(member), { groups });
  }
  return ids;
}

async function createPosts(groupIds: Record<string, string>) {
  const ids: Record<string, string> = {};
  for (const post of samplePosts) {
    const author = users[post.author];
    const group = testGroups.find((g) => g.key === post.group)!;
    const ref = await addDoc(collection(db, "log_posts"), {
      content: post.content,
      amount: post.amount,
      currency: post.currency,
      author: userRef(post.author),
      authorName: author.displayName,
      group: doc(db, "log_groups", groupIds[post.group]),
      groupName: group.title,
      postDate: Timestamp.fromDate(daysAgo(post.daysAgo)),
      createdAt: Timestamp.fromDate(daysAgo(post.daysAgo)),
      commentSubscribers: [userRef(post.author)],
    });
    ids[post.key] = ref.id;
  }
  console.log(`✅ ${samplePosts.length} posts`);

  for (const comment of sampleComments) {
    await addDoc(collection(db, "log_posts", ids[comment.post], "comments"), {
      content: comment.content,
      authorId: userRef(comment.author),
      authorName: users[comment.author].displayName,
      createdAt: Timestamp.now(),
    });
    // Commenting subscribes you to the post's comments.
    await updateDoc(doc(db, "log_posts", ids[comment.post]), {
      commentSubscribers: arrayUnion(userRef(comment.author)),
    });
  }
  console.log(`💬 ${sampleComments.length} comments`);

  for (const reaction of sampleReactions) {
    await updateDoc(doc(db, "log_posts", ids[reaction.post]), {
      [`reactions.${users[reaction.by].docId}`]: reaction.emoji,
    });
  }
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
      defaultCurrency: owner.currency,
      members: [userRef(ledger.owner)],
      memberUids: [owner.uid],
      createdBy: owner.uid,
      categories: categoriesWithBudgets(owner.currency, ledger.budgets),
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
  console.log(`✅ ${testLedgers.length} financial logs (one personal log each, plus a shared one)`);

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

/** Alice's own view: last visits (for "new" badges), a pin, an archived log, prefs. */
async function personaliseAlice(
  groupIds: Record<string, string>,
  postIds: Record<string, string>,
  ledgerIds: Record<string, string>,
) {
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

async function functionsEmulatorIsUp() {
  try {
    await fetch(FUNCTIONS_URL, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
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

    console.log("\n👤 Personal touches");
    await personaliseAlice(groupIds, postIds, ledgerIds);

    console.log("\n🔔 Notifications");
    await writeNotifications(groupIds, ledgerIds);

    console.log("\n🎉 Done. Sign in as alice.vancouver@test.com / test123 to see:");
    console.log(
      "   - home: an ongoing log with new posts, an upcoming one, the 3 latest past logs",
    );
    console.log("   - /me: a 4th past log and an archived one");
    console.log("   - /notifications: joins, a log that just ended, comments, reactions, budgets");
    console.log("   - financial: a personal log over budget in places, a shared one near budget");
    console.log("   Charlie (charlie.london@test.com) sees a log that's ending soon.");
    console.log("   Erik (erik.tokyo@test.com) is good for trying account deletion: one solo");
    console.log('   log to purge, one shared log where his posts become a "deleted user".');

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
