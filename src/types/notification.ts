import { Timestamp } from "firebase/firestore";

/**
 * A notification in `users/{userDocId}/notifications/{id}`, written by Cloud Functions
 * (functions/src/notifications.ts) when someone comments on or reacts to a post the user
 * wrote or is subscribed to. Not shown anywhere yet: this is the shape a future inbox
 * reads. Ids are `comment_{commentId}` or `reaction_{postId}_{actorId}_{emojiCodepoints}`.
 */
export type NotificationType = "comment" | "reaction";

export type AppNotification = {
  id: string;
  type: NotificationType;
  postId: string;
  groupId: string;
  groupName: string;
  actorId: string;
  actorName: string;
  /** reaction only */
  emoji?: string;
  /** comment only */
  commentId?: string;
  /** comment only: plain-text start of the comment */
  excerpt?: string;
  createdAt: Timestamp;
  /** null until the recipient has seen it */
  readAt: Timestamp | null;
};
