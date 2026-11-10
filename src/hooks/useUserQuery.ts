import { deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { useMutation } from "./useFirebase";

type UpdateViewTrackingArgs = {
  userId: string;
  logGroupId: string;
  viewedUserId: string;
};

type UpdateUserProfileArgs = {
  userId: string;
  displayName: string;
  displayLocation?: string;
  timezone: string;
};

type UpdatePinnedPostArgs = {
  userId: string;
  logGroupId: string;
  postId: string;
};

export const useUserQuery = () => {
  // Core mutation functions
  const updateViewTrackingFn = async ({
    userId,
    logGroupId,
    viewedUserId,
  }: UpdateViewTrackingArgs): Promise<void> => {
    console.log("✍️ executing write on users collection");

    await updateDoc(doc(db, "users", userId), {
      [`viewTracking.${logGroupId}.${viewedUserId}.lastViewedAt`]: serverTimestamp(),
    });
  };

  const updateUserProfileFn = async ({
    userId,
    displayName,
    displayLocation,
    timezone,
  }: UpdateUserProfileArgs): Promise<void> => {
    console.log("✍️ executing write on users collection");

    await updateDoc(doc(db, "users", userId), {
      displayName,
      displayLocation,
      timezone,
    });
  };

  const markCommentsAsViewedFn = async ({
    userId,
    logPostId,
  }: {
    userId: string;
    logPostId: string;
  }): Promise<void> => {
    console.log("✍️ executing write on users collection");

    await updateDoc(doc(db, "users", userId), {
      [`commentSubscriptions.${logPostId}.lastViewedAt`]: serverTimestamp(),
    });
  };

  const updatePinnedPostFn = async ({
    userId,
    logGroupId,
    postId,
  }: UpdatePinnedPostArgs): Promise<void> => {
    console.log("✍️ executing write on users collection");

    await updateDoc(doc(db, "users", userId), {
      [`pinnedPosts.${logGroupId}.pinnedPost`]: postId,
    });
  };

  /** Hide a log (social group or ledger) from this user's own lists. */
  const archiveLogFn = async ({ userId, logId }: { userId: string; logId: string }) => {
    await updateDoc(doc(db, "users", userId), {
      [`archivedLogs.${logId}`]: serverTimestamp(),
    });
  };

  const unarchiveLogFn = async ({ userId, logId }: { userId: string; logId: string }) => {
    await updateDoc(doc(db, "users", userId), { [`archivedLogs.${logId}`]: deleteField() });
  };

  /** Remember when this user last looked at a log (see utils/logActivity). */
  const stampLogVisitFn = async ({ userId, logId }: { userId: string; logId: string }) => {
    await updateDoc(doc(db, "users", userId), {
      [`logLastViewedAt.${logId}`]: serverTimestamp(),
    });
  };

  // Mutations
  const updateViewTrackingMutation = useMutation(updateViewTrackingFn);
  const updateUserProfileMutation = useMutation(updateUserProfileFn);
  const updatePinnedPostMutation = useMutation(updatePinnedPostFn);
  const archiveLogMutation = useMutation(archiveLogFn);
  const unarchiveLogMutation = useMutation(unarchiveLogFn);

  return {
    updateViewTracking: updateViewTrackingMutation,
    updateViewTrackingFn,
    updateUserProfile: updateUserProfileMutation,
    updateUserProfileFn,
    markCommentsAsViewedFn,
    updatePinnedPost: updatePinnedPostMutation,
    updatePinnedPostFn,
    archiveLog: archiveLogMutation,
    unarchiveLog: unarchiveLogMutation,
    stampLogVisitFn,
  };
};
