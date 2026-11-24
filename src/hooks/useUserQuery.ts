import {
  deleteField,
  doc,
  FieldPath,
  FieldValue,
  serverTimestamp,
  updateDoc,
  UpdateData,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { useMutation } from "./useFirebase";
import type { Currency } from "@/types/user";
import type { NotificationPrefKey, NotificationType } from "@/types/notification";

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
  timezonePlace?: string;
  defaultCurrency?: Currency;
};

/** Top-level user-doc fields that onboarding, prompts and tours write piecemeal. */
export type UserFieldsPatch = UpdateData<{
  displayName: string;
  displayLocation: string;
  timezone: string;
  timezonePlace: string | FieldValue;
  defaultCurrency: Currency;
  onboardingPending: boolean | FieldValue;
  avatar: string[] | null;
  "tutorials.ledgerNudge": FieldValue;
  "tutorials.sublogIntro": FieldValue;
  emailPaused: boolean;
  checkInReminder: boolean;
  showFriends: boolean;
  hideFromFriendLists: boolean;
}> &
  // Notification settings are written one key at a time (NotificationsSection).
  Partial<Record<`notificationPrefs.${NotificationPrefKey}`, boolean>> &
  Partial<Record<`emailPrefs.${NotificationType}`, boolean>>;

/** Partial write to one user doc (by doc id, not auth uid). */
export const updateUserFields = async (userDocId: string, patch: UserFieldsPatch) => {
  console.log("✍️ executing write on users collection");
  await updateDoc(doc(db, "users", userDocId), patch);
};

/** Record that the ledger tour was finished or skipped on this log (tutorials.ledgerTours). */
export const recordLedgerTour = async (userDocId: string, ledgerId: string) => {
  // A FieldPath, so the log id is one segment whatever characters it holds.
  await updateDoc(
    doc(db, "users", userDocId),
    new FieldPath("tutorials", "ledgerTours", ledgerId),
    serverTimestamp(),
  );
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
    timezonePlace,
    defaultCurrency,
  }: UpdateUserProfileArgs): Promise<void> => {
    console.log("✍️ executing write on users collection");

    await updateDoc(doc(db, "users", userId), {
      displayName,
      displayLocation,
      timezone,
      // A bare zone has no place; clear any city left from before.
      timezonePlace: timezonePlace || deleteField(),
      ...(defaultCurrency ? { defaultCurrency } : {}),
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
