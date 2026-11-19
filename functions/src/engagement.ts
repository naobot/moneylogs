/**
 * Engagement achievements: pure rules, free of the SDK for root Vitest.
 *
 * Plain achievements (no knick-knack) for a first go at something the app offers. The
 * server writes each one once (awardEngagement.ts), with an `achievement_earned`
 * notification. Mirrors src/utils/engagementAchievements.ts, which holds the in-app copy;
 * a root test keeps the two in step and checks firestore.rules lists every type.
 */

export const ENGAGEMENT_ACHIEVEMENTS = {
  first_gift: { title: "Gift Giver", description: "Gave a friend a first gift" },
  first_no_spend_day: { title: "Nothing Spent", description: "Confirmed a first no-spend day" },
  super_lucky: { title: "Super Lucky!", description: "Felt super lucky for the first time" },
  first_social_log: { title: "Joined In", description: "Started or joined a first social log" },
} as const;

export type EngagementAchievementType = keyof typeof ENGAGEMENT_ACHIEVEMENTS;

/** users/{id}/achievements/{id}: one per type, so its existence means "already given". */
export const engagementAchievementId = (type: EngagementAchievementType) => `engagement__${type}`;

/** users/{id}/notifications/{id}: one per type, like its achievement. */
export const engagementNotificationId = (type: EngagementAchievementType) => `achievement_${type}`;

/** Push and email copy for an `achievement_earned` notification. */
export const engagementTitle = (type: unknown): string | null =>
  typeof type === "string" && Object.prototype.hasOwnProperty.call(ENGAGEMENT_ACHIEVEMENTS, type)
    ? ENGAGEMENT_ACHIEVEMENTS[type as EngagementAchievementType].title
    : null;

/** User doc ids in `members` (DocumentReferences to users/{id}) after a write, not before. */
export const addedMemberIds = (before: unknown, after: unknown): string[] => {
  const ids = (members: unknown) =>
    new Set(
      (Array.isArray(members) ? members : [])
        .map((ref) => (ref && typeof ref === "object" ? (ref as { id?: unknown }).id : null))
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
  const was = ids(before);
  return [...ids(after)].filter((id) => !was.has(id));
};
