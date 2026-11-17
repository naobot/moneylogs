import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";

/**
 * Personal invite links: /invite/{code}. Opening one makes you friends with whoever sent
 * it (functions/src/invites.ts). Each person has one code at a time; resetting it retires
 * the old link.
 */

export type AcceptInviteResult = { state: "friends" | "self"; inviterId: string };

const getInviteCodeCallable = httpsCallable<{ reset?: boolean }, { code: string }>(
  functions,
  "getInviteCode",
);
const acceptInviteCallable = httpsCallable<{ code: string }, AcceptInviteResult>(
  functions,
  "acceptInvite",
);

export const getInviteCode = async (reset = false) =>
  (await getInviteCodeCallable(reset ? { reset } : {})).data.code;

export const acceptInvite = async (code: string) => (await acceptInviteCallable({ code })).data;
