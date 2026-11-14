import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import Button from "@/components/Button";
import { useCurrentUser } from "@/contexts";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotificationFeed,
} from "@/hooks/useNotifications";
import { useNow } from "@/hooks/useNow";
import { AppNotification } from "@/types/notification";
import { NotificationItem } from "@/features/notifications/NotificationItem";
import { db } from "@/config/firebase-config";
import { notificationHref } from "@/utils/notificationTypes";

import "@/features/notifications/notifications.scss";

/**
 * Every notification, newest first. Arriving here marks them all read, but whatever was
 * unread on arrival keeps its "new" frame until you leave, so you can still see what
 * changed.
 */
export const Notifications = () => {
  const { user } = useCurrentUser();
  const userDocId = user?.id;
  const { items, isLoading, isError, hasMore, isLoadingMore, loadMore } =
    useNotificationFeed(userDocId);
  const now = useNow().toDate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openId = searchParams.get("open");

  // A tapped push lands here with ?open=<id>: follow that notification's own link, the
  // same one its row in the list opens, and mark it read on the way.
  useEffect(() => {
    if (!userDocId || !openId) return;
    const run = { cancelled: false };
    void getDoc(doc(db, "users", userDocId, "notifications", openId))
      .then((snap) => {
        if (run.cancelled) return;
        if (!snap.exists()) {
          void navigate("/notifications", { replace: true });
          return;
        }
        const n = {
          id: snap.id,
          ...snap.data({ serverTimestamps: "estimate" }),
        } as AppNotification;
        markNotificationRead(userDocId, n).catch(() => {});
        void navigate(notificationHref(n), { replace: true });
      })
      .catch(() => {
        if (!run.cancelled) void navigate("/notifications", { replace: true });
      });
    return () => {
      run.cancelled = true;
    };
  }, [userDocId, openId, navigate]);

  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const markedFor = useRef<string>();

  useEffect(() => {
    if (!userDocId || isLoading) return;
    // Anything that arrives while the page is open counts as new too.
    const unread = items.filter((n) => !n.readAt).map((n) => n.id);
    if (!unread.length) return;
    setFreshIds((prev) => new Set([...prev, ...unread]));
    if (markedFor.current === unread.join()) return;
    markedFor.current = unread.join();
    markAllNotificationsRead(userDocId).catch((error) =>
      console.error("Failed to mark notifications read:", error),
    );
  }, [userDocId, isLoading, items]);

  const openNotification = (n: AppNotification) => {
    if (userDocId) markNotificationRead(userDocId, n).catch(() => {});
  };

  return (
    <div className="Window Notifications">
      <div className="Window__heading">
        <h2>notifications</h2>
      </div>

      {isLoading && <p className="Notifications__status">loading…</p>}
      {isError && <p className="Notifications__status">couldn't load notifications.</p>}
      {!isLoading && !isError && !items.length && (
        <p className="Notifications__status">
          nothing yet. Comments, reactions, log updates and budget alerts will show up here.
        </p>
      )}

      {items.length > 0 && (
        <ul className="Notifications__list">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem
                notification={n}
                fresh={!n.readAt || freshIds.has(n.id)}
                onOpen={openNotification}
                now={now}
              />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="Notifications__more">
          <Button
            text="Load more"
            buttonStyle="primary-border-lite"
            size="sm"
            loading={isLoadingMore}
            onClick={() => {
              loadMore().catch((error) => console.error("Failed to load notifications:", error));
            }}
          />
        </div>
      )}
    </div>
  );
};
