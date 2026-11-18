import { deleteDoc, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/config/firebase-config";
import type { LogKind } from "@/types/notification";

/**
 * Inviting friends into a log (functions/src/logInvites.ts). Each friend gets a
 * `log_invite` notification linking to the log's join page; joining still happens there.
 */

export type InviteFriendsResult = {
  invited: string[];
  skipped: Array<{ id: string; reason: "self" | "not_friends" | "member" }>;
};

const inviteFriendsCallable = httpsCallable<
  { logId: string; logKind: LogKind; friendIds: string[] },
  InviteFriendsResult
>(functions, "inviteFriendsToLog");

export const inviteFriendsToLog = async (logId: string, logKind: LogKind, friendIds: string[]) =>
  (await inviteFriendsCallable({ logId, logKind, friendIds })).data;

/** The id the server gives a log's invite in each inbox (one per log). */
export const logInviteNotificationId = (logId: string) => `log_invite_${logId}`;

/** Once you've joined, the invite has done its job: take it out of your inbox. */
export const clearLogInvite = (userDocId: string, logId: string) =>
  deleteDoc(doc(db, "users", userDocId, "notifications", logInviteNotificationId(logId)));
