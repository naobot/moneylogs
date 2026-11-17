/**
 * Pure rules for personal invite links (invites.ts), free of the SDK for root Vitest.
 *
 * Everyone has one invite code at a time, kept at invites/{code} → { inviterId } and
 * written only by the server. Opening someone's link makes you friends straight away:
 * sharing it is the inviter's consent, and opening it is yours.
 */

import { randomBytes } from "node:crypto";
import type { FriendState } from "./friendsPlan";

export const INVITE_CODE_LENGTH = 10;

const CODE = new RegExp(`^[A-Za-z0-9_-]{${INVITE_CODE_LENGTH}}$`);

/** A new random, URL-safe code. */
export const newInviteCode = (): string =>
  randomBytes(INVITE_CODE_LENGTH).toString("base64url").slice(0, INVITE_CODE_LENGTH);

/** `{ code }`, or null if malformed. */
export const parseInviteCode = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const { code } = data as Record<string, unknown>;
  return typeof code === "string" && CODE.test(code) ? code : null;
};

/** `{ reset? }` for getInviteCode. */
export const parseReset = (data: unknown): boolean =>
  !!data && typeof data === "object" && (data as Record<string, unknown>).reset === true;

/**
 * What opening an invite does from where the two stand: a new friendship, accepting a
 * request that was already pending either way, or nothing if they're already friends.
 */
export type InviteAction = "create-accepted" | "accept" | "noop";

export const planInvite = (state: FriendState): InviteAction =>
  state === "friends" ? "noop" : state === "none" ? "create-accepted" : "accept";
