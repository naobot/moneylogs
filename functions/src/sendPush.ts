import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { deadDevices, pushCopy } from "./pushCopy";

/**
 * Sends a push for every new inbox notification to the recipient's devices
 * (users/{userDocId}/devices, registered when they turn push on in the app).
 *
 * Every writer of the inbox has already applied the recipient's notification
 * preferences, so this needs no checks of its own. The payload carries only the
 * notification id; a tap opens /notifications?open=<id>, which resolves the link from
 * the stored notification.
 */
export const sendPushOnNotification = onDocumentCreated(
  "users/{userDocId}/notifications/{notificationId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const copy = pushCopy(data);
    if (!copy) return;

    const db = getFirestore();
    const devices = await db
      .collection("users")
      .doc(event.params.userDocId)
      .collection("devices")
      .get();
    const usable = devices.docs.filter((d) => typeof d.get("token") === "string");
    if (!usable.length) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens: usable.map((d) => d.get("token") as string),
      notification: copy,
      data: { notificationId: event.params.notificationId },
      apns: { payload: { aps: { sound: "default" } } },
    });

    const dead = new Set(
      deadDevices(
        usable.map((d) => d.id),
        response.responses,
      ),
    );
    await Promise.all(usable.filter((d) => dead.has(d.id)).map((d) => d.ref.delete()));
    if (dead.size) console.log(`sendPush: dropped ${dead.size} dead device token(s)`);
  },
);
