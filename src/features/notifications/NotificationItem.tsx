import { Link } from "react-router-dom";
import cx from "classnames";

import dayjs from "@/utils/configuredDayjs";
import Icon from "@/components/Icon";
import { AppNotification } from "@/types/notification";
import {
  describeNotification,
  notificationDetail,
  notificationHref,
  notificationIcon,
} from "@/utils/notificationTypes";

type NotificationItemProps = {
  notification: AppNotification;
  /** Shown as new. Usually `!readAt`; the page keeps it on for what was unread on arrival. */
  fresh: boolean;
  onOpen?: (notification: AppNotification) => void;
  /** The pop-up's denser variant: no detail line. */
  compact?: boolean;
  /** From useNow, so relative times keep counting on a page left open. */
  now: Date;
};

/** One notification as a link to whatever it's about. */
export const NotificationItem = ({
  notification,
  fresh,
  onOpen,
  compact = false,
  now,
}: NotificationItemProps) => {
  const detail = compact ? undefined : notificationDetail(notification);
  const createdAt = notification.createdAt?.toDate?.();

  return (
    <Link
      to={notificationHref(notification)}
      onClick={() => onOpen?.(notification)}
      className={cx("NotificationItem", {
        "NotificationItem--fresh": fresh,
        "NotificationItem--compact": compact,
      })}
    >
      <Icon type={notificationIcon(notification)} size={compact ? 18 : 21} />
      <span className="NotificationItem__body">
        <span className="NotificationItem__text">
          {describeNotification(notification, now).map((part, i) =>
            typeof part === "string" ? (
              <span key={i}>{part}</span>
            ) : (
              <span key={i} className="keep-case NotificationItem__name">
                {part.keep}
              </span>
            ),
          )}
        </span>
        {detail && <span className="NotificationItem__detail keep-case">{detail}</span>}
        {createdAt && (
          <time className="NotificationItem__time" dateTime={createdAt.toISOString()}>
            {dayjs(createdAt).from(now)}
          </time>
        )}
      </span>
      {fresh && <span className="sr-only">(new)</span>}
    </Link>
  );
};
