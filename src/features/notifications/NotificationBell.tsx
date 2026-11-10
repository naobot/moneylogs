import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import Button from "@/components/Button";
import Popover from "@/components/Popover";
import { useCurrentUser } from "@/contexts";
import { isMousePointer, useHoverIntent } from "@/hooks/useHoverIntent";
import { markNotificationRead, useLatestNotifications } from "@/hooks/useNotifications";
import { useNow } from "@/hooks/useNow";
import { AppNotification } from "@/types/notification";
import { unreadBadge } from "@/utils/notificationTypes";
import { NotificationItem } from "./NotificationItem";

import "./notifications.scss";

/** How many the hover pop-up lists before "see all". */
export const POPUP_LIMIT = 6;

/**
 * The nav's bell. Clicking goes to /notifications. Hovering with a mouse shows the
 * latest few after a short delay. Touch has no hover, so a tap simply navigates.
 */
export const NotificationBell = () => {
  const { user } = useCurrentUser();
  const userDocId = user?.id;
  const { items, unreadCount } = useLatestNotifications(userDocId);
  const { pathname } = useLocation();

  const now = useNow();

  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  // The path the pop-up was opened on: navigating anywhere (including through the
  // pop-up) closes it, without an effect to reset it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const { openAfterDelay, cancelOpen, closeAfterDelay, cancelClose } = useHoverIntent();

  const onPage = pathname === "/notifications";
  const badge = unreadBadge(unreadCount);
  const label = unreadCount ? `Notifications, ${badge} unread` : "Notifications";

  const hold = () => {
    cancelClose();
    if (!open && !onPage) openAfterDelay(() => setOpen(true));
  };
  const release = () => {
    cancelOpen();
    closeAfterDelay(() => setOpen(false));
  };

  const openNotification = (n: AppNotification) => {
    setOpen(false);
    if (userDocId) {
      markNotificationRead(userDocId, n).catch((error) =>
        console.error("Failed to mark notification read:", error),
      );
    }
  };

  return (
    <>
      <span
        ref={setAnchor}
        className="NotificationBell"
        onPointerEnter={(e) => isMousePointer(e) && hold()}
        onPointerLeave={(e) => isMousePointer(e) && release()}
      >
        <Button
          className="MainNav__item--icon"
          to="/notifications"
          icon="bell"
          aria-label={label}
          isSelected={onPage}
        />
        {badge && (
          <span className="NotificationBell__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </span>

      <Popover
        anchor={anchor}
        open={open && !onPage}
        onClose={() => setOpen(false)}
        placement="bottom"
        align="end"
        className="NotificationPopup"
        role="dialog"
        aria-label="Latest notifications"
        onPointerEnter={(e) => isMousePointer(e) && cancelClose()}
        onPointerLeave={(e) => isMousePointer(e) && release()}
      >
        <div className="NotificationPopup__title">notifications</div>
        {items.length ? (
          <ul className="NotificationPopup__list">
            {items.slice(0, POPUP_LIMIT).map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  fresh={!n.readAt}
                  onOpen={openNotification}
                  compact
                  now={now.toDate()}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="NotificationPopup__empty">nothing yet</p>
        )}
        <Link to="/notifications" className="NotificationPopup__all">
          see all
        </Link>
      </Popover>
    </>
  );
};
