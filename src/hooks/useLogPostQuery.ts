import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { getGroupDocRef, getUserDocRef, useMutation } from "./useFirebase";
import { Currency } from "@/types/user";

type AddNewLogPostArgs = {
  groupId: string;
  userId: string;
  logData: LogData;
};

export type LogData = {
  amount: number;
  content: string;
  currency: Currency;
  postDate: number;
  timezone?: string;
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
    }> = {};

    if (logData.timezone !== undefined) postData.timezone = logData.timezone;

    const batch = writeBatch(db);
    const postRef = doc(collection(db, "log_posts"));
    batch.set(postRef, {
      amount: logData?.amount,
      currency: logData?.currency,
      content: logData?.content,
      author: userDocRef,
      authorName: userName,
      postDate: Timestamp.fromMillis(logData?.postDate),
      group: groupDocRef,
      groupName,
      commentSubscribers: [userDocRef],
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
      timezone: string;
    }> = {};

    if (logData.content !== undefined) updateData.content = logData.content;
    if (logData.postDate !== undefined)
      updateData.postDate = Timestamp.fromMillis(logData.postDate);
    if (logData.amount !== undefined) updateData.amount = logData.amount;
    if (logData.currency !== undefined) updateData.currency = logData.currency;
    if (logData.timezone !== undefined) updateData.timezone = logData.timezone;

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
  };
};
