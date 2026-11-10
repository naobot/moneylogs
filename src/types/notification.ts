import { Timestamp } from "firebase/firestore";

/**
 * A notification lives at `users/{userDocId}/notifications/{id}`. Ids are deterministic,
 * so a writer that runs twice can't produce duplicates. Cloud Functions write the
 * social-activity, timeline and budget ones (functions/src/notifications.ts and
 * friends). The client writes only the ones whose recipient is the actor (starting or
 * joining a log).
 *
 * Copy, links and default on/off for every type live in src/utils/notificationTypes.ts.
 */
export type NotificationType =
  | "comment"
  | "reaction"
  | "log_created"
  | "log_joined"
  | "log_ending"
  | "log_ended"
  | "budget_approaching"
  | "budget_exceeded"
  | "budget_projected";

/** Which collection `groupId` points into. Missing on older docs, which are all social. */
export type LogKind = "social" | "ledger";

type Base = {
  id: string;
  /** Log or ledger id. deleteLog cleans up notifications by this field. */
  groupId: string;
  groupName: string;
  logKind?: LogKind;
  /** The estimate is used while a client write is pending, so this is always set when read. */
  createdAt: Timestamp;
  /** null until the recipient has seen it */
  readAt: Timestamp | null;
};

/** Why a post notification reached you. Older docs predate this and leave it out. */
export type PostReason = "author" | "subscriber";

export type CommentNotification = Base & {
  type: "comment";
  postId: string;
  commentId: string;
  actorId: string;
  actorName: string;
  /** plain-text start of the comment */
  excerpt?: string;
  reason?: PostReason;
};

export type ReactionNotification = Base & {
  type: "reaction";
  postId: string;
  actorId: string;
  actorName: string;
  emoji: string;
  reason?: PostReason;
};

export type LogMembershipNotification = Base & {
  type: "log_created" | "log_joined";
};

export type LogTimelineNotification = Base & {
  type: "log_ending" | "log_ended";
  /** The recipient's own end time (personalEnd). */
  endsAt: Timestamp;
  /** log_ended: when the summary unlocks for everyone (absoluteEnd). */
  summaryAt?: Timestamp;
};

export type BudgetNotification = Base & {
  type: "budget_approaching" | "budget_exceeded" | "budget_projected";
  /** "YYYY-MM" */
  month: string;
  currency: string;
  spent: number;
  budget: number;
  /** budget_projected: the month-end total at the current pace */
  projected?: number;
  /** Set when the alert is about one category's budget, not the month's total. */
  categoryId?: string;
  categoryName?: string;
};

export type AppNotification =
  | CommentNotification
  | ReactionNotification
  | LogMembershipNotification
  | LogTimelineNotification
  | BudgetNotification;

/** The notification shape for one type, even where a variant covers several types. */
export type NotificationOf<T extends NotificationType> = AppNotification extends infer N
  ? N extends { type: infer U }
    ? T extends U
      ? N & { type: T }
      : never
    : never
  : never;

/**
 * Keys in `users.notificationPrefs`: each type, plus budget_category, which governs the
 * per-category variants of the budget alerts.
 */
export type NotificationPrefKey = NotificationType | "budget_category";

export type NotificationPrefs = Partial<Record<NotificationPrefKey, boolean>>;
