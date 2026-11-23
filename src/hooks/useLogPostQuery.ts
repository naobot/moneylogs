import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldValue,
  increment,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { getGroupDocRef, getUserDocRef, useMutation } from "./useFirebase";
import { Currency } from "@/types/user";
import { CurrencyAmounts } from "@/types/ledger";
import { primaryOf } from "@/utils/postAmounts";

type AddNewLogPostArgs = {
  groupId: string;
  userId: string;
  logData: LogData;
};

export type LogData = {
  /**
   * Spending per currency. Required for a new post; on edit, leave it out when the
   * amounts didn't change, so they're written back untouched.
   */
  amounts?: CurrencyAmounts;
  /** The primary currency: the editor's first row, written to the legacy fields. */
  currency: Currency;
  content: string;
  postDate: number;
  /** Pull keys (`pullKey`) of financial-log entries pulled into the post (no ledger ids). */
  pulledEntryIds?: string[];
  /** A travelling post's own zone. On edit, null clears it back to the author's. */
  timezone?: string | null;
  /** The city picked for that zone ("Kyoto"); null or empty clears it. */
  timezonePlace?: string | null;
};

type ToggleReactionArgs = {
  logPostId: string;
  /** The reacting user's users-collection doc id (not the auth uid). */
  userDocId: string;
  emoji: string;
  /** true adds the emoji, false removes it. */
  add: boolean;
};

type AddCommentArgs = {
  logPostId: string;
  userId: string;
  content: string;
};

type DeleteCommentArgs = {
  logPostId: string;
  commentId: string;
};

export const useLogPostQuery = () => {
  const addNewLogPostFn = async ({
    groupId,
    userId,
    logData,
  }: AddNewLogPostArgs): Promise<string> => {
    const [{ userDocRef, userName }, { groupDocRef, groupName }] = await Promise.all([
      getUserDocRef(userId),
      getGroupDocRef(groupId),
    ]);

    const postData: Partial<{
      timezone: string;
      timezonePlace: string;
    }> = {};

    if (logData.timezone) {
      postData.timezone = logData.timezone;
      if (logData.timezonePlace) postData.timezonePlace = logData.timezonePlace;
    }

    const batch = writeBatch(db);
    const postRef = doc(collection(db, "log_posts"));
    const amounts = logData.amounts ?? { [logData.currency]: 0 };
    const primary = primaryOf(amounts, logData.currency, logData.currency);
    batch.set(postRef, {
      amount: primary.amount,
      currency: primary.currency,
      amounts,
      amountsPrimary: primary.currency,
      content: logData?.content,
      author: userDocRef,
      authorName: userName,
      postDate: Timestamp.fromMillis(logData?.postDate),
      group: groupDocRef,
      groupName,
      commentSubscribers: [userDocRef],
      ...(logData.pulledEntryIds?.length ? { pulledEntryIds: logData.pulledEntryIds } : {}),
      ...postData,
    });

    console.log("✍️ executing write on log_posts collection");
    await batch.commit();

    return postRef.id;
  };

  const editLogPostFn = async ({
    postId,
    logData,
  }: {
    postId: string;
    logData: LogData;
  }): Promise<void> => {
    const updateData: Partial<{
      content: string;
      postDate: Timestamp;
      amount: number;
      currency: string;
      amounts: CurrencyAmounts;
      pulledEntryIds: string[];
      amountsPrimary: string;
      timezone: string | FieldValue;
      timezonePlace: string | FieldValue;
    }> = {};

    if (logData.content !== undefined) updateData.content = logData.content;
    if (logData.postDate !== undefined)
      updateData.postDate = Timestamp.fromMillis(logData.postDate);
    if (logData.amounts !== undefined) {
      // The whole map is replaced, so a removed currency row disappears.
      const primary = primaryOf(logData.amounts, logData.currency, logData.currency);
      updateData.amounts = logData.amounts;
      updateData.amountsPrimary = primary.currency;
      updateData.amount = primary.amount;
      updateData.currency = primary.currency;
    }
    if (logData.pulledEntryIds !== undefined) updateData.pulledEntryIds = logData.pulledEntryIds;
    if (logData.timezone !== undefined) {
      updateData.timezone = logData.timezone || deleteField();
      updateData.timezonePlace = (logData.timezone && logData.timezonePlace) || deleteField();
    }

    console.log("✍️ executing write on log_posts collection");
    await updateDoc(doc(db, "log_posts", postId), updateData);
  };

  const deleteLogPostFn = async ({ logPostId }: { logPostId: string }): Promise<void> => {
    console.log("🗑️ executing delete on log_posts collection");
    await deleteDoc(doc(db, "log_posts", logPostId));
  };

  const addCommentFn = async ({ logPostId, userId, content }: AddCommentArgs): Promise<string> => {
    const { userDocRef, userName } = await getUserDocRef(userId);

    const commentRef = doc(collection(db, "log_posts", logPostId, "comments"));
    const postRef = doc(db, "log_posts", logPostId);

    const batch = writeBatch(db);
    batch.set(commentRef, {
      authorId: userDocRef,
      authorName: userName,
      content,
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, {
      commentCount: increment(1),
      commentSubscribers: arrayUnion(userDocRef),
    });

    console.log("✍️ executing batched write on log_posts collection (comment + counter)");
    await batch.commit();

    return commentRef.id;
  };

  // Reactions live on the post as `reactions.{userDocId}: string[]`, so each toggle is a
  // single atomic array write scoped to the reacting user (the emoji itself is never a
  // field-path segment). Reacting does not subscribe the user to the post's comments.
  const toggleReactionFn = async ({
    logPostId,
    userDocId,
    emoji,
    add,
  }: ToggleReactionArgs): Promise<void> => {
    console.log(`✍️ executing reaction ${add ? "add" : "remove"} on log_posts collection`);
    await updateDoc(doc(db, "log_posts", logPostId), {
      [`reactions.${userDocId}`]: add ? arrayUnion(emoji) : arrayRemove(emoji),
    });
  };

  const deleteCommentFn = async ({ logPostId, commentId }: DeleteCommentArgs): Promise<void> => {
    const batch = writeBatch(db);
    batch.delete(doc(db, "log_posts", logPostId, "comments", commentId));
    batch.update(doc(db, "log_posts", logPostId), {
      commentCount: increment(-1),
    });

    console.log("🗑️ executing batched delete on log_posts collection (comment + counter)");
    await batch.commit();
  };

  // Mutations
  const addNewLogPostMutation = useMutation(addNewLogPostFn);
  const addCommentMutation = useMutation(addCommentFn);
  const editLogPostMutation = useMutation(editLogPostFn);
  const deleteCommentMutation = useMutation(deleteCommentFn);
  const deleteLogPostMutation = useMutation(deleteLogPostFn);
  const toggleReactionMutation = useMutation(toggleReactionFn);

  return {
    addNewLogPost: addNewLogPostMutation,
    addNewLogPostFn,
    addComment: addCommentMutation,
    addCommentFn,
    deleteComment: deleteCommentMutation,
    deleteCommentFn,
    deleteLogPost: deleteLogPostMutation,
    deleteLogPostFn,
    editLogPost: editLogPostMutation,
    editLogPostFn,
    toggleReaction: toggleReactionMutation,
    toggleReactionFn,
  };
};
