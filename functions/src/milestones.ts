/**
 * Milestone knick-knacks: pure rules, free of the SDK for root Vitest.
 *
 * Unlike the seasonal finds, these are never found by chance. The buddy hands one over
 * with an achievement, and only for achievements that encourage healthy use of the app
 * (achievements like top spender stay achievements only). They stay with whoever
 * earned them: none can be gifted. The coins come from check-in streaks (coins.ts); the
 * others are one-offs given the first time something happens (awardMilestone.ts).
 */

import type { KnickKnackId } from "./knickknacks";

/** The one-off milestones, by what earns them. */
export const FIRST_SOCIAL_ENTRY = "heart_leaf" satisfies KnickKnackId;
export const FIRST_COMMENT_ON_OTHERS = "paper_crane" satisfies KnickKnackId;
export const FIRST_FRIEND = "friendship_bracelet" satisfies KnickKnackId;
export const FIRST_INVITE = "little_envelope" satisfies KnickKnackId;

/**
 * users/{id}/achievements/{id} for a milestone. One per item, so the id is fixed and
 * its existence records that the item has been given.
 */
export const milestoneAchievementId = (item: string) => `milestone__${item}`;

/** users/{id}/notifications/{id} for a milestone: one per item, like its achievement. */
export const milestoneNotificationId = (item: string) => `milestone_${item}`;

/** A comment earns the paper crane only on someone else's entry. */
export const isCommentOnOthers = (commenterId: unknown, postAuthorId: unknown): boolean =>
  typeof commenterId === "string" &&
  typeof postAuthorId === "string" &&
  commenterId !== postAuthorId;
