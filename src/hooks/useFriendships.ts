import { useEffect, useMemo } from "react";
import { collection, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useFirebaseCollection } from "@/hooks/useFirebase";
import { Friendship, FriendState, friendState, otherUser } from "@/utils/friends";
import { reportError } from "@/utils/reportError";

/** One person you have a friendship (or pending request) with. */
export type FriendEntry = { userDocId: string; state: Exclude<FriendState, "none"> };

/**
 * Your friendships and requests, live: one array-contains query on your auth uid (what
 * the read rule allows), no composite index.
 */
export const useFriendships = () => {
  const { user } = useCurrentUser();
  const me = user?.id;
  const uid = user?.userId;

  const result = useFirebaseCollection<Friendship>({
    queryBuilder: () =>
      uid ? query(collection(db, "friendships"), where("uids", "array-contains", uid)) : null,
    dataTransformer: (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Friendship),
    dependencies: [uid],
    enabled: !!uid,
  });

  useEffect(() => {
    if (result.isError)
      reportError(result.error, { feature: "friends", action: "load_friendships" });
  }, [result.isError, result.error]);

  const entries = useMemo<FriendEntry[]>(
    () =>
      me
        ? result.data.map((f) => ({
            userDocId: otherUser(f, me),
            state: friendState(f, me) as FriendEntry["state"],
          }))
        : [],
    [result.data, me],
  );

  const stateWith = (otherUserDocId: string): FriendState =>
    entries.find((e) => e.userDocId === otherUserDocId)?.state ?? "none";

  return {
    entries,
    friends: entries.filter((e) => e.state === "friends").map((e) => e.userDocId),
    incoming: entries.filter((e) => e.state === "incoming").map((e) => e.userDocId),
    outgoing: entries.filter((e) => e.state === "outgoing").map((e) => e.userDocId),
    stateWith,
    isLoading: result.isLoading || (!!uid && !result.isSuccess && !result.isError),
  };
};

type FriendCallResult = { state: FriendState };

const requestFriendCallable = httpsCallable<{ otherUserDocId: string }, FriendCallResult>(
  functions,
  "requestFriend",
);
const respondFriendCallable = httpsCallable<
  { otherUserDocId: string; accept: boolean },
  FriendCallResult
>(functions, "respondFriend");
const removeFriendCallable = httpsCallable<{ otherUserDocId: string }, FriendCallResult>(
  functions,
  "removeFriend",
);

/** Ask someone to be friends; accepts instead if they already asked you. */
export const requestFriend = async (otherUserDocId: string) =>
  (await requestFriendCallable({ otherUserDocId })).data.state;

export const respondFriend = async (otherUserDocId: string, accept: boolean) =>
  (await respondFriendCallable({ otherUserDocId, accept })).data.state;

/** Cancel your request, decline theirs, or unfriend. */
export const removeFriend = async (otherUserDocId: string) =>
  (await removeFriendCallable({ otherUserDocId })).data.state;
