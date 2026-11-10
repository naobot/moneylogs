import { useCallback, useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { AppNotification } from "@/types/notification";
import { countUnread, LATEST_NOTIFICATIONS_LIMIT } from "@/utils/notificationTypes";
import { useFirebaseCollection } from "./useFirebase";

const notificationsOf = (userDocId: string) => collection(db, "users", userDocId, "notifications");

// The estimate fills in createdAt while a client write is still pending.
const toNotification = (d: QueryDocumentSnapshot): AppNotification =>
  ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as AppNotification;

/**
 * The latest notifications, live. The unread count comes from this same window rather
 * than a `readAt == null` query. That avoids a composite index, and a badge reading
 * "9+" doesn't need an exact total.
 */
export const useLatestNotifications = (userDocId: string | undefined) => {
  const result = useFirebaseCollection<AppNotification>({
    queryBuilder: () =>
      userDocId
        ? query(
            notificationsOf(userDocId),
            orderBy("createdAt", "desc"),
            limit(LATEST_NOTIFICATIONS_LIMIT),
          )
        : null,
    dataTransformer: (docs) => docs.map(toNotification),
    dependencies: [userDocId],
    enabled: !!userDocId,
  });

  useEffect(() => {
    if (result.isError) console.error("Failed to load notifications:", result.error);
  }, [result.isError, result.error]);

  const items = userDocId ? result.data : [];
  return {
    items,
    unreadCount: countUnread(items),
    isLoading: !!userDocId && !result.isSuccess && !result.isError,
    isError: result.isError,
  };
};

const OLDER_PAGE_SIZE = 20;
const NONE: AppNotification[] = [];

/**
 * The /notifications feed. The newest page is the live window from
 * useLatestNotifications; older pages are fetched once, on demand, after it.
 */
export const useNotificationFeed = (userDocId: string | undefined) => {
  const latest = useLatestNotifications(userDocId);
  // Older pages belong to the user they were fetched for, so switching accounts starts
  // over without an effect to reset them.
  const [olderState, setOlderState] = useState<{
    userDocId?: string;
    items: AppNotification[];
    exhausted: boolean;
  }>({ items: [], exhausted: false });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const own = olderState.userDocId === userDocId;
  const older = own ? olderState.items : NONE;
  const olderExhausted = own && olderState.exhausted;

  const latestFull = latest.items.length >= LATEST_NOTIFICATIONS_LIMIT;
  const hasMore = latestFull && !olderExhausted;

  const loadMore = useCallback(async () => {
    if (!userDocId || isLoadingMore) return;
    const last = older[older.length - 1] ?? latest.items[latest.items.length - 1];
    if (!last) return;
    setIsLoadingMore(true);
    try {
      const snapshot = await getDocs(
        query(
          notificationsOf(userDocId),
          orderBy("createdAt", "desc"),
          startAfter(last.createdAt),
          limit(OLDER_PAGE_SIZE),
        ),
      );
      const page = snapshot.docs.map(toNotification);
      setOlderState((prev) => {
        const kept = prev.userDocId === userDocId ? prev.items : [];
        // A new notification shifts the live window, so drop anything already shown.
        const seen = new Set(kept.map((n) => n.id));
        return {
          userDocId,
          items: [...kept, ...page.filter((n) => !seen.has(n.id))],
          exhausted: page.length < OLDER_PAGE_SIZE,
        };
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [userDocId, isLoadingMore, older, latest.items]);

  const latestIds = new Set(latest.items.map((n) => n.id));
  const items = [...latest.items, ...older.filter((n) => !latestIds.has(n.id))];

  return {
    items,
    unreadCount: latest.unreadCount,
    isLoading: latest.isLoading,
    isError: latest.isError,
    hasMore,
    isLoadingMore,
    loadMore,
  };
};

const BATCH_LIMIT = 500;

const stampRead = async (userDocId: string, ids: string[]) => {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc(db, "users", userDocId, "notifications", id), {
        readAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
};

export const markNotificationRead = (userDocId: string, notification: AppNotification) =>
  notification.readAt ? Promise.resolve() : stampRead(userDocId, [notification.id]);

/**
 * Marks every unread notification read, including ones older than any loaded page.
 * A single equality filter needs no composite index.
 */
export const markAllNotificationsRead = async (userDocId: string) => {
  const unread = await getDocs(query(notificationsOf(userDocId), where("readAt", "==", null)));
  await stampRead(
    userDocId,
    unread.docs.map((d) => d.id),
  );
};
