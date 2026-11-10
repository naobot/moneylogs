import { onSchedule } from "firebase-functions/v2/scheduler";
import { DocumentReference, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { timelineNotificationsFor, timelineQueryWindow } from "./logTimeline";

// Firestore's gRPC code for a create() whose document already exists.
const ALREADY_EXISTS = 6;

/**
 * Hourly: tell each member of a social log when it's about to end for them (under 24h
 * left) and when it has. Only logs whose stored `end` is near now are read. That's a
 * single-field range, so the index is automatic. Each notification has a fixed id and
 * is created at most once, so overlapping runs and retries can't duplicate one or reset
 * its read state.
 */
export const notifyLogTimeline = onSchedule(
  { schedule: "every 60 minutes", timeoutSeconds: 300 },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const { from, to } = timelineQueryWindow(now);

    const groups = await db
      .collection("log_groups")
      .where("end", ">=", Timestamp.fromMillis(from))
      .where("end", "<=", Timestamp.fromMillis(to))
      .get();

    let created = 0;
    for (const groupSnap of groups.docs) {
      const data = groupSnap.data();
      if (data.deleting || !(data.end instanceof Timestamp)) continue;

      const memberRefs = ((data.members ?? []) as unknown[]).filter(
        (ref): ref is DocumentReference =>
          !!ref && typeof (ref as DocumentReference).id === "string",
      );
      if (!memberRefs.length) continue;

      const group = {
        id: groupSnap.id,
        title: typeof data.title === "string" ? data.title : "",
        endWallClock: typeof data.endWallClock === "string" ? data.endWallClock : undefined,
        endMs: data.end.toMillis(),
      };

      const members = await db.getAll(
        ...memberRefs.map((ref) => db.collection("users").doc(ref.id)),
      );
      for (const member of members) {
        if (!member.exists) continue;
        for (const { id, data: notification } of timelineNotificationsFor(
          group,
          member.data() ?? {},
          now,
        )) {
          try {
            await member.ref
              .collection("notifications")
              .doc(id)
              .create({ ...notification, createdAt: FieldValue.serverTimestamp(), readAt: null });
            created++;
          } catch (error) {
            if ((error as { code?: number }).code !== ALREADY_EXISTS) {
              console.error(`notifyLogTimeline: ${id} for ${member.id}:`, error);
            }
          }
        }
      }
    }

    console.log(`notifyLogTimeline: ${groups.size} logs near their end, ${created} notified`);
  },
);
