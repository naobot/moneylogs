// scripts/check-rules.ts
//
// Checks the social-log Firestore rules (log_groups, log_posts, comments, processing),
// plus ledger schedules, scheduled entries, budget snapshots and the `deleting` guards,
// against the local emulator: each case is a write the app makes, which must be allowed,
// or a forged one, which must be denied. Run it after changing firestore.rules:
//
//   firebase emulators:start --only firestore,auth
//   npm run check-rules
//
// It signs up throwaway users (*@rules-check.test), so it's safe alongside seeded data.
import {
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  deleteField,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, docPath, ownerWrite } from "./emulator";

// Outside the app tsconfig: declare the bit of Node this uses.
declare const process: { exit(code?: number): never };

setLogLevel("silent");

let failures = 0;

async function allowed(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  ✅ allows ${label}`);
  } catch (e) {
    failures++;
    console.log(`  ❌ should allow ${label}: ${(e as Error).message.split("\n")[0]}`);
  }
}

async function denied(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    failures++;
    console.log(`  ❌ should deny ${label}: it was allowed`);
  } catch (e) {
    const message = (e as Error).message;
    // The code is the reliable signal: some denials (e.g. a signed-out read) come back
    // from the emulator with only "false for 'get' @ L…" as the message.
    if (
      (e as { code?: string }).code === "permission-denied" ||
      /PERMISSION_DENIED|permission/i.test(message)
    ) {
      console.log(`  ✅ denies ${label}`);
    } else {
      failures++;
      console.log(`  ❌ should deny ${label}: failed another way: ${message.split("\n")[0]}`);
    }
  }
}

const run = Date.now();

async function makeUser(name: string) {
  const email = `${name}-${run}@rules-check.test`;
  const { user } = await createUserWithEmailAndPassword(auth, email, "test123");
  const ref = await addDoc(collection(db, "users"), { userId: user.uid, displayName: name });
  return { email, uid: user.uid, ref, id: ref.id };
}
type User = Awaited<ReturnType<typeof makeUser>>;

const signInAs = (user: User) => signInWithEmailAndPassword(auth, user.email, "test123");

/** What the app writes for a new log (addNewLogGroupFn). */
const logData = (creator: User, overrides: Record<string, unknown> = {}) => ({
  title: "trip",
  max_participants: 3,
  startWallClock: "2026-11-01T00:00",
  endWallClock: "2026-11-30T00:00",
  start: Timestamp.now(),
  end: Timestamp.now(),
  createdAt: serverTimestamp(),
  createdBy: creator.uid,
  members: [creator.ref],
  ...overrides,
});

/** Join the way the invite page does (joinGroupFn): prepend yourself. */
const join = (logRef: ReturnType<typeof doc>, user: User) =>
  runTransaction(db, async (tx) => {
    const snap = await tx.get(logRef);
    tx.update(logRef, { members: [user.ref, ...snap.data()!.members] });
  });

async function main() {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const mallory = await makeUser("mallory");
  const carol = await makeUser("carol");

  console.log("\nlog_groups");
  await signInAs(alice);
  const logRef = doc(collection(db, "log_groups"));
  await allowed("a new log with only its creator", () => setDoc(logRef, logData(alice)));
  await allowed("a log of the largest size (30)", () =>
    addDoc(collection(db, "log_groups"), logData(alice, { max_participants: 30 })),
  );
  await denied("a log over the largest size (31)", () =>
    addDoc(collection(db, "log_groups"), logData(alice, { max_participants: 31 })),
  );
  await denied("a new log with someone else as its member", () =>
    addDoc(collection(db, "log_groups"), logData(alice, { members: [bob.ref] })),
  );
  await denied("a new log with two members", () =>
    addDoc(collection(db, "log_groups"), logData(alice, { members: [alice.ref, bob.ref] })),
  );
  await denied("a new log created by someone else", () =>
    addDoc(collection(db, "log_groups"), logData(alice, { createdBy: bob.uid })),
  );
  await denied("a new log with server fields (analytics)", () =>
    addDoc(collection(db, "log_groups"), logData(alice, { analytics: {} })),
  );
  await allowed("the creator renaming", () => updateDoc(logRef, { title: "trip 2" }));
  await denied("the creator raising the size", () => updateDoc(logRef, { max_participants: 99 }));

  await signInAs(bob);
  await denied("a non-creator renaming", () => updateDoc(logRef, { title: "pwned" }));
  await allowed("joining through the invite page", () => join(logRef, bob));

  // A guest (anonymous sign-in, src/features/auth/guest.ts) with their own user doc.
  const { user: guestAuth } = await signInAnonymously(auth);
  const guestRef = await addDoc(collection(db, "users"), {
    userId: guestAuth.uid,
    displayName: "guest",
  });
  await denied("a guest joining someone else's log", () =>
    join(logRef, { email: "", uid: guestAuth.uid, ref: guestRef, id: guestRef.id }),
  );
  await signOut(auth);

  await signInAs(mallory);
  await denied("adding someone else as a member", async () => {
    const snap = await getDoc(logRef);
    await updateDoc(logRef, { members: [carol.ref, ...snap.data()!.members] });
  });
  await denied("replacing the member list", () =>
    updateDoc(logRef, { members: [mallory.ref, alice.ref] }),
  );
  await denied("a member deleting the log", () => deleteDoc(logRef));
  await allowed("joining the last free place", () => join(logRef, mallory));

  await signInAs(carol);
  await denied("joining a full log", () => join(logRef, carol));
  // A reference nested under your own user doc ends in someone else's id.
  const nested = (owner: User, victim: User) =>
    doc(db, "users", owner.id, "achievements", victim.id);
  const roomyLog = doc(collection(db, "log_groups"));
  await setDoc(roomyLog, logData(carol, { max_participants: 5 }));
  await denied("joining with a reference nested under your own user doc", () =>
    updateDoc(roomyLog, { members: [nested(carol, alice), carol.ref] }),
  );

  await signOut(auth);
  await allowed("reading a log signed out (spectators)", () => getDoc(logRef));
  await denied("writing a log signed out", () => updateDoc(logRef, { title: "x" }));

  console.log("\nlog_posts");
  /** What the app writes for a new post (addNewLogPostFn). */
  const postData = (author: User, overrides: Record<string, unknown> = {}) => ({
    amount: 5,
    currency: "CAD",
    amounts: { CAD: 5 },
    amountsPrimary: "CAD",
    content: "hi",
    author: author.ref,
    authorName: "x",
    postDate: Timestamp.now(),
    group: logRef,
    groupName: "trip",
    commentSubscribers: [author.ref],
    ...overrides,
  });
  await signInAs(bob);
  const postRef = doc(collection(db, "log_posts"));
  await allowed("a member posting as themselves", () =>
    setDoc(postRef, postData(bob, { timezone: "Asia/Tokyo", timezonePlace: "Tokyo" })),
  );
  await denied("a member posting as someone else", () =>
    addDoc(
      collection(db, "log_posts"),
      postData(bob, { author: alice.ref, commentSubscribers: [alice.ref] }),
    ),
  );
  await denied("a post that arrives with reactions", () =>
    addDoc(collection(db, "log_posts"), postData(bob, { reactions: { [alice.id]: ["🔥"] } })),
  );
  await denied("a post whose group isn't a log", () =>
    addDoc(collection(db, "log_posts"), postData(bob, { group: bob.ref })),
  );
  await denied("a post whose group is nested under a log", () =>
    addDoc(
      collection(db, "log_posts"),
      postData(bob, { group: doc(db, "log_groups", logRef.id, "x", "y") }),
    ),
  );
  await denied("a post by a reference nested under your own user doc", () =>
    addDoc(
      collection(db, "log_posts"),
      postData(bob, { author: nested(bob, alice), commentSubscribers: [nested(bob, alice)] }),
    ),
  );
  await denied("a post without a postDate", () => {
    const { postDate: _postDate, ...rest } = postData(bob);
    return addDoc(collection(db, "log_posts"), rest);
  });
  await denied("a post whose amount isn't a number", () =>
    addDoc(collection(db, "log_posts"), postData(bob, { amount: "5" })),
  );
  await allowed("the author editing", () =>
    updateDoc(postRef, { content: "edited", amounts: { CAD: 6 }, amount: 6 }),
  );
  await denied("the author changing authorship", () => updateDoc(postRef, { author: alice.ref }));
  await denied("the author removing the postDate", () =>
    updateDoc(postRef, { postDate: deleteField() }),
  );

  await signInAs(carol);
  await denied("a non-member posting", () => addDoc(collection(db, "log_posts"), postData(carol)));
  await denied("a non-member reacting", () =>
    updateDoc(postRef, { [`reactions.${carol.id}`]: arrayUnion("🔥") }),
  );

  await signInAs(alice);
  await denied("another member editing the post", () => updateDoc(postRef, { content: "x" }));
  await allowed("a member reacting", () =>
    updateDoc(postRef, { [`reactions.${alice.id}`]: arrayUnion("🔥") }),
  );
  await allowed("a member taking a reaction back", () =>
    updateDoc(postRef, { [`reactions.${alice.id}`]: arrayRemove("🔥") }),
  );
  await denied("reacting as someone else", () =>
    updateDoc(postRef, { [`reactions.${bob.id}`]: arrayUnion("🔥") }),
  );
  await signInAs(bob);
  await allowed("a second reactor (not the first key)", () =>
    updateDoc(postRef, { [`reactions.${bob.id}`]: arrayUnion("👍") }),
  );
  await signInAs(mallory);
  await allowed("a third reactor", () =>
    updateDoc(postRef, { [`reactions.${mallory.id}`]: arrayUnion("👍") }),
  );
  await denied("changing two people's reactions at once", () =>
    updateDoc(postRef, {
      [`reactions.${mallory.id}`]: arrayUnion("🔥"),
      [`reactions.${bob.id}`]: arrayRemove("👍"),
    }),
  );

  console.log("\ncomments");
  await signInAs(alice);
  const commentRef = doc(collection(db, "log_posts", postRef.id, "comments"));
  await allowed("a member commenting (with the count, like the app)", async () => {
    const batch = writeBatch(db);
    batch.set(commentRef, {
      authorId: alice.ref,
      authorName: "alice",
      content: "nice",
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, {
      commentCount: increment(1),
      commentSubscribers: arrayUnion(alice.ref),
    });
    await batch.commit();
  });
  await denied("a comment by a reference nested under your own user doc", async () => {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "log_posts", postRef.id, "comments")), {
      authorId: nested(alice, bob),
      authorName: "bob",
      content: "x",
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, { commentCount: increment(1) });
    await batch.commit();
  });
  await denied("a comment without the count going up", () =>
    addDoc(collection(db, "log_posts", postRef.id, "comments"), {
      authorId: alice.ref,
      authorName: "alice",
      content: "x",
      createdAt: serverTimestamp(),
    }),
  );
  await denied("subscribing someone else to the comments", () =>
    updateDoc(postRef, { commentCount: increment(1), commentSubscribers: arrayUnion(carol.ref) }),
  );

  await signInAs(carol);
  await denied("a non-member commenting", async () => {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "log_posts", postRef.id, "comments")), {
      authorId: carol.ref,
      authorName: "carol",
      content: "x",
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, {
      commentCount: increment(1),
      commentSubscribers: arrayUnion(carol.ref),
    });
    await batch.commit();
  });
  await denied("deleting someone else's comment", () => deleteDoc(commentRef));
  await denied("a non-member subscribing to the comments", () =>
    updateDoc(postRef, { commentCount: increment(1), commentSubscribers: arrayUnion(carol.ref) }),
  );

  await signInAs(alice);
  await allowed("the commenter deleting (with the count)", async () => {
    const batch = writeBatch(db);
    batch.delete(commentRef);
    batch.update(postRef, { commentCount: increment(-1) });
    await batch.commit();
  });
  await denied("another member deleting the post", () => deleteDoc(postRef));

  await signOut(auth);
  await allowed("reading a post signed out", () => getDoc(postRef));
  await denied("editing a post signed out", () => updateDoc(postRef, { content: "x" }));

  console.log("\nprocessing");
  await ownerWrite(`processing/${logRef.id}`, { step: "x", percentage: 10 });
  await allowed("reading analytics progress signed out", () =>
    getDoc(doc(db, "processing", logRef.id)),
  );
  await signInAs(alice);
  await denied("a client writing progress", () =>
    setDoc(doc(db, "processing", logRef.id), { step: "x" }),
  );

  console.log("\nclosed logs");
  const HOUR = 3_600_000;
  const closingLog = async (endMsAgo: number, wallClock: boolean) => {
    const ref = doc(collection(db, "log_groups"));
    await ownerWrite(`log_groups/${ref.id}`, {
      title: "old trip",
      max_participants: 3,
      endWallClock: wallClock ? "2026-11-01T00:00" : undefined,
      end: new Date(Date.now() - endMsAgo),
      members: [docPath(`users/${bob.id}`)],
    });
    return ref;
  };
  const stillOpenLater = await closingLog(20 * HOUR, true);
  const closedEverywhere = await closingLog(27 * HOUR, true);
  const olderClosed = await closingLog(HOUR, false);
  await signInAs(bob);
  await allowed("posting 20h after a wall-clock log's end (later timezones still open)", () =>
    addDoc(collection(db, "log_posts"), postData(bob, { group: stillOpenLater })),
  );
  await denied("posting 27h after a wall-clock log's end", () =>
    addDoc(collection(db, "log_posts"), postData(bob, { group: closedEverywhere })),
  );
  await denied("posting after an older log's end", () =>
    addDoc(collection(db, "log_posts"), postData(bob, { group: olderClosed })),
  );
  await ownerWrite(
    `log_groups/${logRef.id}`,
    { analytics: { isCalculated: true } },
    { merge: true },
  );
  await denied("posting once the log's summary is saved", () =>
    addDoc(collection(db, "log_posts"), postData(bob)),
  );
  await denied("changing an amount once the summary is saved", () =>
    updateDoc(postRef, { amount: 7, amounts: { CAD: 7 } }),
  );
  await denied("changing the date once the summary is saved", () =>
    updateDoc(postRef, { postDate: Timestamp.now() }),
  );
  await allowed("fixing the words once the summary is saved", () =>
    updateDoc(postRef, { content: "typo fixed" }),
  );

  await allowed("the author deleting their post", () => deleteDoc(postRef));

  console.log("\na social log being deleted (purgeLog)");
  await signInAs(alice);
  const doomedLog = doc(collection(db, "log_groups"));
  await setDoc(doomedLog, logData(alice));
  const doomedPost = doc(collection(db, "log_posts"));
  await setDoc(doomedPost, postData(alice, { group: doomedLog }));
  // What purgeLog sets (Admin SDK) before removing the posts.
  await ownerWrite(`log_groups/${doomedLog.id}`, { deleting: true }, { merge: true });
  await denied("a new post in it", () =>
    addDoc(collection(db, "log_posts"), postData(alice, { group: doomedLog })),
  );
  await denied("a new comment in it", async () => {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "log_posts", doomedPost.id, "comments")), {
      authorId: alice.ref,
      authorName: "alice",
      content: "x",
      createdAt: serverTimestamp(),
    });
    batch.update(doomedPost, {
      commentCount: increment(1),
      commentSubscribers: arrayUnion(alice.ref),
    });
    await batch.commit();
  });
  await signOut(auth);

  console.log("\nledger schedules + scheduled entries");
  await signInAs(alice);
  const ledgerRef = doc(collection(db, "ledgers"));
  await allowed("a new ledger", () =>
    setDoc(ledgerRef, {
      title: "home",
      max_participants: 3,
      members: [alice.ref],
      memberUids: [alice.uid],
      categories: [{ id: "housing", name: "Housing", order: 0 }],
      defaultCurrency: "CAD",
      createdAt: serverTimestamp(),
      createdBy: alice.uid,
    }),
  );
  await signInAs(bob);
  await allowed("bob joining the ledger", () =>
    updateDoc(ledgerRef, { members: arrayUnion(bob.ref), memberUids: arrayUnion(bob.uid) }),
  );
  const scheduleData = (owner: User, overrides: Record<string, unknown> = {}) => ({
    categoryId: "housing",
    label: "rent",
    amount: 1200,
    currency: "CAD",
    repeat: { every: "month", day: 1 },
    ownerUid: owner.uid,
    ownerDocId: owner.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  });
  const schedules = collection(db, "ledgers", ledgerRef.id, "schedules");
  await signInAs(alice);
  const scheduleRef = doc(schedules);
  await allowed("a member scheduling a payment of their own", () =>
    setDoc(scheduleRef, scheduleData(alice)),
  );
  await allowed("a yearly schedule", () =>
    addDoc(schedules, scheduleData(alice, { repeat: { every: "year", month: 3, day: 12 } })),
  );
  await denied("a schedule owned by someone else", () =>
    addDoc(schedules, scheduleData(alice, { ownerUid: bob.uid, ownerDocId: bob.id })),
  );
  await denied("a schedule naming someone else's user doc", () =>
    addDoc(schedules, scheduleData(alice, { ownerDocId: bob.id })),
  );
  await denied("a schedule that sets its own booking", () =>
    addDoc(schedules, scheduleData(alice, { nextDue: "2026-12-01", nextDueAt: Timestamp.now() })),
  );
  await denied("a schedule with a bad repeat", () =>
    addDoc(schedules, scheduleData(alice, { repeat: { every: "week", day: 1 } })),
  );
  await denied("a schedule with no amount", () =>
    addDoc(schedules, scheduleData(alice, { amount: 0 })),
  );
  await allowed("the owner changing the amount and pausing", () =>
    updateDoc(scheduleRef, { amount: 1250, paused: true, updatedAt: serverTimestamp() }),
  );
  await denied("the owner moving the booking", () =>
    updateDoc(scheduleRef, { nextDue: "2026-12-02", updatedAt: serverTimestamp() }),
  );
  await denied("the owner moving it to another category", () =>
    updateDoc(scheduleRef, { categoryId: "food", updatedAt: serverTimestamp() }),
  );
  await signInAs(bob);
  await allowed("another member reading it", () => getDoc(scheduleRef));
  await denied("another member editing it", () =>
    updateDoc(scheduleRef, { amount: 1, updatedAt: serverTimestamp() }),
  );
  await denied("another member deleting it", () => deleteDoc(scheduleRef));
  await signOut(auth);
  await denied("a stranger reading it", () => getDoc(scheduleRef));

  await signInAs(alice);
  const entryData = (overrides: Record<string, unknown> = {}) => ({
    amount: 1200,
    currency: "CAD",
    categoryId: "housing",
    date: "2026-11-01",
    month: "2026-11",
    note: "rent",
    author: alice.ref,
    authorUid: alice.uid,
    authorName: "alice",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  });
  const entries = collection(db, "ledgers", ledgerRef.id, "entries");
  await denied("a client logging an entry as scheduled", () =>
    addDoc(entries, entryData({ scheduleId: scheduleRef.id })),
  );
  const scheduledEntry = doc(entries, `${scheduleRef.id}_2026-11-01`);
  // What logScheduledEntries writes (Admin SDK, past the rules).
  await ownerWrite(`ledgers/${ledgerRef.id}/entries/${scheduledEntry.id}`, {
    amount: 1200,
    currency: "CAD",
    categoryId: "housing",
    date: "2026-11-01",
    month: "2026-11",
    note: "rent",
    author: docPath(`users/${alice.id}`),
    authorUid: alice.uid,
    authorName: "alice",
    scheduleId: scheduleRef.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await allowed("the owner fixing a scheduled entry's amount", () =>
    updateDoc(scheduledEntry, { amount: 1300, updatedAt: serverTimestamp() }),
  );
  await denied("unmarking a scheduled entry", () =>
    updateDoc(scheduledEntry, { scheduleId: deleteField(), updatedAt: serverTimestamp() }),
  );
  await allowed("the owner deleting a scheduled entry", () => deleteDoc(scheduledEntry));
  await allowed("the owner deleting their schedule", () => deleteDoc(scheduleRef));

  console.log("\nledger budget snapshots");
  const snapshotData = () => ({
    budgets: { housing: { CAD: 1200 } },
    names: { housing: "Housing" },
    snapshotAt: serverTimestamp(),
  });
  await allowed("a member keeping a finished month's budgets", () =>
    setDoc(doc(db, "ledgers", ledgerRef.id, "budgetSnapshots", "2026-10"), snapshotData()),
  );
  await denied("rewriting a kept month", () =>
    setDoc(doc(db, "ledgers", ledgerRef.id, "budgetSnapshots", "2026-10"), snapshotData()),
  );
  // What purgeLog sets (Admin SDK) before removing the ledger.
  await ownerWrite(`ledgers/${ledgerRef.id}`, { deleting: true }, { merge: true });
  await denied("a snapshot while the ledger is being deleted", () =>
    setDoc(doc(db, "ledgers", ledgerRef.id, "budgetSnapshots", "2026-09"), snapshotData()),
  );
  await denied("an entry while the ledger is being deleted", () => addDoc(entries, entryData()));

  console.log(failures ? `\n❌ ${failures} case(s) failed` : "\n🎉 every case passed");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ check-rules stopped:", error);
  process.exit(1);
});
