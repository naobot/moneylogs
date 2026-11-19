import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { awardEngagementQuietly } from "./awardEngagement";
import { addedMemberIds } from "./engagement";
import { withSentry } from "./sentry";

/**
 * The "Joined In" achievement for whoever starts or joins a social log. Clients add
 * members to log_groups themselves, so this watches for new ids in `members`. Most
 * writes to a log (title, analytics) add no one and stop here.
 */
export const awardSocialLogJoin = onDocumentWritten(
  "log_groups/{groupId}",
  withSentry("awardSocialLogJoin", async (event) => {
    const after = event.data?.after.data();
    if (!after || after.deleting === true) return;
    const added = addedMemberIds(event.data?.before.data()?.members, after.members);
    if (!added.length) return;
    const db = getFirestore();
    await Promise.all(
      added.map((userId) => awardEngagementQuietly({ db, userId, type: "first_social_log" })),
    );
  }),
);
