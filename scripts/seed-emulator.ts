// scripts/seed-emulator.ts
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
} from "firebase/firestore";

// This script runs under tsx (Node); `process` is provided by the runtime but
// this file is outside the app tsconfig, so declare the bit we use.
declare const process: { exit(code?: number): never };

// Mock Firebase config for emulator
const mockConfig = {
  apiKey: "mock-api-key",
  authDomain: "mock-auth-domain",
  projectId: "moneylogs-89ebf",
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id",
};

const app = initializeApp(mockConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to emulators
try {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8888);
} catch {
  console.log("Emulators already connected or not running");
}

// Test users representing different timezones
const testUsers = [
  {
    email: "alice.vancouver@test.com",
    password: "test123",
    displayName: "Alice Chen",
    timezone: "America/Vancouver",
  },
  {
    email: "bob.nyc@test.com",
    password: "test123",
    displayName: "Bob Rodriguez",
    timezone: "America/New_York",
  },
  {
    email: "charlie.london@test.com",
    password: "test123",
    displayName: "Charlie Williams",
    timezone: "Europe/London",
  },
  {
    email: "diana.berlin@test.com",
    password: "test123",
    displayName: "Diana Mueller",
    timezone: "Europe/Berlin",
  },
  {
    email: "erik.tokyo@test.com",
    password: "test123",
    displayName: "Erik Tanaka",
    timezone: "Asia/Tokyo",
  },
  {
    email: "fiona.singapore@test.com",
    password: "test123",
    displayName: "Fiona Lim",
    timezone: "Asia/Singapore",
  },
];

// Test groups
const testGroups = [
  {
    title: "Roommates - Vancouver House",
    members: [
      "alice.vancouver@test.com",
      "bob.nyc@test.com",
      "charlie.london@test.com",
      "diana.berlin@test.com",
    ],
    max_participants: 10,
  },
  {
    title: "Asia Trip 2025",
    members: [
      "charlie.london@test.com",
      "diana.berlin@test.com",
      "erik.tokyo@test.com",
      "fiona.singapore@test.com",
    ],
    max_participants: 10,
  },
];

// Sample expenses with different currencies and timezones
const sampleExpenses = [
  {
    content: "Groceries for the week",
    amount: 85.5,
    currency: "CAD",
    authorEmail: "alice.vancouver@test.com",
    groupIndex: 0,
    daysAgo: 2,
  },
  {
    content: "Utilities bill - electricity",
    amount: 120.0,
    currency: "USD",
    authorEmail: "bob.nyc@test.com",
    groupIndex: 0,
    daysAgo: 5,
  },
  {
    content: "Internet bill",
    amount: 45.99,
    currency: "GBP",
    authorEmail: "charlie.london@test.com",
    groupIndex: 0,
    daysAgo: 7,
  },
  {
    content: "Cleaning supplies",
    amount: 32.75,
    currency: "EUR",
    authorEmail: "diana.berlin@test.com",
    groupIndex: 0,
    daysAgo: 1,
  },

  {
    content: "Tokyo hotel booking",
    amount: 15000,
    currency: "JPY",
    authorEmail: "erik.tokyo@test.com",
    groupIndex: 1,
    daysAgo: 10,
  },
  {
    content: "Flight to Singapore",
    amount: 450.0,
    currency: "SGD",
    authorEmail: "fiona.singapore@test.com",
    groupIndex: 1,
    daysAgo: 15,
  },
  {
    content: "Train tickets in Europe",
    amount: 89.5,
    currency: "EUR",
    authorEmail: "diana.berlin@test.com",
    groupIndex: 1,
    daysAgo: 8,
  },
  {
    content: "Restaurant dinner in London",
    amount: 125.8,
    currency: "GBP",
    authorEmail: "charlie.london@test.com",
    groupIndex: 1,
    daysAgo: 3,
  },
];

// Comments for posts
const sampleComments = [
  { content: "Thanks for getting these! 🛒", authorEmail: "bob.nyc@test.com" },
  { content: "Can we split this evenly?", authorEmail: "charlie.london@test.com" },
  { content: "Perfect timing on the hotel booking!", authorEmail: "fiona.singapore@test.com" },
  { content: "Great choice of restaurant 👍", authorEmail: "erik.tokyo@test.com" },
];

type SeededUser = { uid: string } & (typeof testUsers)[0];

async function createUser(userInfo: (typeof testUsers)[0]) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userInfo.email,
      userInfo.password,
    );
    const user = userCredential.user;

    // Create user document in Firestore
    const userDoc = {
      userId: user.uid,
      email: userInfo.email,
      displayName: userInfo.displayName,
      createdAt: Timestamp.now(),
      groups: [], // Will be populated when we create groups
    };

    await setDoc(doc(db, "users", user.uid), userDoc);
    console.log(`✅ Created user: ${userInfo.displayName}`);

    return { uid: user.uid, ...userInfo };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/email-already-in-use"
    ) {
      // User already exists, sign in to get UID
      const userCredential = await signInWithEmailAndPassword(
        auth,
        userInfo.email,
        userInfo.password,
      );
      console.log(`🔄 User already exists: ${userInfo.displayName}`);
      return { uid: userCredential.user.uid, ...userInfo };
    }
    throw error;
  }
}

async function createLogGroup(groupInfo: (typeof testGroups)[0], createdUsers: SeededUser[]) {
  const memberUids = createdUsers
    .filter((user) => groupInfo.members.includes(user.email))
    .map((user) => doc(db, "users", user.uid));

  const groupData = {
    title: groupInfo.title,
    members: memberUids,
    max_participants: groupInfo.max_participants,
    createdAt: Timestamp.now(),
    start: Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // 30 days ago
    end: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days from now
  };

  const groupDocRef = await addDoc(collection(db, "log_groups"), groupData);
  console.log(`✅ Created group: ${groupInfo.title}`);

  // Update user documents to include this group
  // Note: In a real scenario, you'd use arrayUnion to add the group ID to each
  // member's user document. For seeding, we leave the groups array as-is.

  return groupDocRef.id;
}

async function createLogPost(
  expense: (typeof sampleExpenses)[0],
  createdUsers: SeededUser[],
  groupId: string,
) {
  const author = createdUsers.find((user) => user.email === expense.authorEmail);
  if (!author) return;

  const postDate = new Date(Date.now() - expense.daysAgo * 24 * 60 * 60 * 1000);

  const postData = {
    content: expense.content,
    amount: expense.amount,
    currency: expense.currency,
    author: doc(db, "users", author.uid),
    authorName: author.displayName,
    group: doc(db, "log_groups", groupId),
    groupName: testGroups[expense.groupIndex].title,
    postDate: Timestamp.fromDate(postDate),
    createdAt: Timestamp.fromDate(postDate),
    commentSubscribers: [doc(db, "users", author.uid)],
  };

  const postDocRef = await addDoc(collection(db, "log_posts"), postData);
  console.log(`✅ Created post: ${expense.content} (${expense.currency} ${expense.amount})`);

  return postDocRef.id;
}

async function addComment(
  postId: string,
  comment: (typeof sampleComments)[0],
  createdUsers: SeededUser[],
) {
  const author = createdUsers.find((user) => user.email === comment.authorEmail);
  if (!author) return;

  const commentData = {
    content: comment.content,
    authorId: doc(db, "users", author.uid),
    authorName: author.displayName,
    createdAt: Timestamp.now(),
  };

  await addDoc(collection(db, "log_posts", postId, "comments"), commentData);
  console.log(`💬 Added comment: "${comment.content}" by ${author.displayName}`);
}

// Financial-mode ledgers. These go through the members-only security rules, so each
// write is made while signed in as the acting user.
const DEFAULT_LEDGER_CATEGORIES = [
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
].map((name, order) => ({ id: name.toLowerCase(), name, order }));

const testLedgers = [
  {
    title: "Alice personal",
    ownerEmail: "alice.vancouver@test.com",
    joinerEmails: [] as string[],
    defaultCurrency: "CAD",
  },
  {
    title: "Alice + Bob home",
    ownerEmail: "alice.vancouver@test.com",
    joinerEmails: ["bob.nyc@test.com"],
    defaultCurrency: "CAD",
  },
];

const sampleEntries = [
  {
    ledgerIndex: 0,
    authorEmail: "alice.vancouver@test.com",
    daysAgo: 0,
    amount: 14.5,
    currency: "CAD",
    categoryId: "food",
    note: "Ramen",
  },
  {
    ledgerIndex: 0,
    authorEmail: "alice.vancouver@test.com",
    daysAgo: 1,
    amount: 82.3,
    currency: "CAD",
    categoryId: "groceries",
  },
  {
    ledgerIndex: 0,
    authorEmail: "alice.vancouver@test.com",
    daysAgo: 3,
    amount: 3.15,
    currency: "CAD",
    categoryId: "transport",
    note: "Bus",
  },
  {
    ledgerIndex: 0,
    authorEmail: "alice.vancouver@test.com",
    daysAgo: 40,
    amount: 1200,
    currency: "JPY",
    categoryId: "food",
    note: "Onigiri haul",
  },
  {
    ledgerIndex: 1,
    authorEmail: "alice.vancouver@test.com",
    daysAgo: 2,
    amount: 1850,
    currency: "CAD",
    categoryId: "housing",
    note: "Rent",
  },
  {
    ledgerIndex: 1,
    authorEmail: "bob.nyc@test.com",
    daysAgo: 2,
    amount: 96.4,
    currency: "CAD",
    categoryId: "utilities",
    note: "Hydro",
  },
  {
    ledgerIndex: 1,
    authorEmail: "bob.nyc@test.com",
    daysAgo: 5,
    amount: 120,
    currency: "USD",
    categoryId: "groceries",
  },
];

const dateKeyDaysAgo = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function signInAs(email: string) {
  const seeded = testUsers.find((u) => u.email === email);
  if (!seeded) throw new Error(`Unknown seed user ${email}`);
  await signInWithEmailAndPassword(auth, seeded.email, seeded.password);
}

async function createLedgers(createdUsers: SeededUser[]) {
  const ledgerIds: string[] = [];
  for (const ledger of testLedgers) {
    const owner = createdUsers.find((u) => u.email === ledger.ownerEmail);
    if (!owner) continue;
    await signInAs(owner.email);
    const ref = await addDoc(collection(db, "ledgers"), {
      title: ledger.title,
      max_participants: 4,
      defaultCurrency: ledger.defaultCurrency,
      members: [doc(db, "users", owner.uid)],
      memberUids: [owner.uid],
      categories: DEFAULT_LEDGER_CATEGORIES,
      createdAt: serverTimestamp(),
    });
    for (const email of ledger.joinerEmails) {
      const joiner = createdUsers.find((u) => u.email === email);
      if (!joiner) continue;
      await signInAs(email);
      await updateDoc(ref, {
        members: arrayUnion(doc(db, "users", joiner.uid)),
        memberUids: arrayUnion(joiner.uid),
      });
    }
    console.log(`✅ Created financial log: ${ledger.title}`);
    ledgerIds.push(ref.id);
  }

  for (const entry of sampleEntries) {
    const author = createdUsers.find((u) => u.email === entry.authorEmail);
    const ledgerId = ledgerIds[entry.ledgerIndex];
    if (!author || !ledgerId) continue;
    await signInAs(author.email);
    const date = dateKeyDaysAgo(entry.daysAgo);
    await addDoc(collection(db, "ledgers", ledgerId, "entries"), {
      amount: entry.amount,
      currency: entry.currency,
      categoryId: entry.categoryId,
      date,
      month: date.slice(0, 7),
      ...(entry.note ? { note: entry.note } : {}),
      author: doc(db, "users", author.uid),
      authorUid: author.uid,
      authorName: author.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log(`✅ Created ${sampleEntries.length} financial entries`);
  return ledgerIds;
}

async function seedEmulator() {
  console.log("🌱 Starting emulator seeding...");

  try {
    // Create users
    console.log("\n👥 Creating users...");
    const createdUsers = [];
    for (const userInfo of testUsers) {
      const user = await createUser(userInfo);
      createdUsers.push(user);
    }

    // Create groups
    console.log("\n📁 Creating log groups...");
    const groupIds = [];
    for (const groupInfo of testGroups) {
      const groupId = await createLogGroup(groupInfo, createdUsers);
      groupIds.push(groupId);
    }

    // Create posts
    console.log("\n📝 Creating log posts...");
    const postIds = [];
    for (const expense of sampleExpenses) {
      const groupId = groupIds[expense.groupIndex];
      const postId = await createLogPost(expense, createdUsers, groupId);
      if (postId) postIds.push(postId);
    }

    // Add some comments
    console.log("\n💬 Adding comments...");
    if (postIds.length > 0) {
      await addComment(postIds[0], sampleComments[0], createdUsers);
      await addComment(postIds[1], sampleComments[1], createdUsers);
      if (postIds.length > 4) {
        await addComment(postIds[4], sampleComments[2], createdUsers);
        await addComment(postIds[7], sampleComments[3], createdUsers);
      }
    }

    console.log("\n💰 Creating financial logs...");
    const ledgerIds = await createLedgers(createdUsers);

    console.log("\n🎉 Emulator seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`- ${createdUsers.length} users created`);
    console.log(`- ${groupIds.length} groups created`);
    console.log(`- ${postIds.length} posts created`);
    console.log(`- ${ledgerIds.length} financial logs created`);
    console.log("- Several comments added");
    console.log("\n🔗 Open Emulator UI: http://127.0.0.1:1331/");
  } catch (error) {
    console.error("❌ Error seeding emulator:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seeding
seedEmulator();
