// scripts/check-rules.ts
//
// Checks the social-log Firestore rules (log_groups, log_posts, comments, processing)
// against the local emulator: each case is a write the app makes, which must be allowed,
// or a forged one, which must be denied. Run it after changing firestore.rules:
//
//   firebase emulators:start --only firestore,auth
//   npm run check-rules
//
// It signs up throwaway users (*@rules-check.test), so it's safe alongside seeded data.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
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
import { auth, db, ownerWrite } from "./emulator";

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
    if (/PERMISSION_DENIED|permission/i.test(message)) {
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

/** Join the way the invite page does (addMemberToGroupFn): prepend yourself. */
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
  await allowed("the author editing", () =>
    updateDoc(postRef, { content: "edited", amounts: { CAD: 6 }, amount: 6 }),
  );
  await denied("the author changing authorship", () => updateDoc(postRef, { author: alice.ref }));

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

  await signInAs(bob);
  await allowed("the author deleting their post", () => deleteDoc(postRef));

  console.log(failures ? `\n❌ ${failures} case(s) failed` : "\n🎉 every case passed");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ check-rules stopped:", error);
  process.exit(1);
});
