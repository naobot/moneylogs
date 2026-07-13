import { useMemo, useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { LogPost } from "@/types/user";
import { useCurrentUser } from "@/contexts";
import { UserData } from "@/hooks/useGetUserInfo";
import { FullUserData } from "@/hooks/useGetGroupUsers";

import { applyMemberOrder } from "@/utils/memberOrder";
import { memberHasUnreadPosts, postHasUnreadComments } from "@/utils/unread";
import { shouldShowCommentBadge, shouldShowPostBell } from "./navBadges";
import useDragReorderEnabled from "@/hooks/useDragReorderEnabled";
import Icon from "@/components/Icon";

import cx from "classnames";

type LogMember = FullUserData & {
  lastUpdated?: Record<string, { seconds: number }>;
  displayLocation?: string;
};
type SerializedMember = LogMember & { hasUnreadPosts: boolean };

interface LogsMenuProps {
  displaySummary: boolean;
  displayAll: boolean;
  displayUser?: UserData | null;
  logMembers: LogMember[];
  logPosts: Array<LogPost>;
  onChangeUser: (user?: unknown) => void;
  onViewSummary: () => void;
  groupId: string;
  isReadOnly: boolean;
  // How many member profiles are still streaming in (group member count minus the
  // profiles loaded so far). On a slow connection the list can render with just the
  // current user — this renders skeleton rows so it's clearly still loading.
  loadingMemberCount?: number;
}

const MEMBER_ORDER_KEY = (groupId: string) => `ML__${groupId}__memberOrder`;

// Cap skeleton rows so a transiently large count can't blow out the layout.
const MAX_MEMBER_SKELETONS = 8;

const LogsMenu = ({
  displaySummary = false,
  displayAll = false,
  displayUser = null,
  logMembers,
  logPosts,
  onChangeUser,
  onViewSummary,
  groupId,
  isReadOnly = false,
  loadingMemberCount = 0,
}: LogsMenuProps) => {
  const { user } = useCurrentUser();

  const dragEnabled = useDragReorderEnabled();

  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MEMBER_ORDER_KEY(groupId)) ?? "null");
      setOrderedIds(Array.isArray(saved) ? saved : []);
    } catch {
      setOrderedIds([]);
    }
  }, [groupId]);

  const isSpectator = useMemo(() => {
    if (!user?.id) return true;
    return !logMembers?.some((m) => m.id === user.id);
  }, [user?.id, logMembers]);

  const serializedMembers = useMemo(() => {
    if (!logMembers) return [];

    return logMembers.map((member) => {
      if (isSpectator || !user?.id || user?.viewTracking === undefined) {
        return { ...member, hasUnreadPosts: false };
      }
      const hasUnreadPosts = memberHasUnreadPosts({
        member,
        viewTracking: user.viewTracking,
        groupId,
      });

      return { ...member, hasUnreadPosts };
    });
  }, [isSpectator, user?.viewTracking, logMembers, groupId, user?.id]);

  const orderedMembers = useMemo(
    () => applyMemberOrder(serializedMembers, orderedIds, user?.id),
    [serializedMembers, orderedIds, user?.id],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedMembers.findIndex((m) => m.id === active.id);
    const newIndex = orderedMembers.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(orderedMembers, oldIndex, newIndex);
    const newIds = reordered.map((m) => m.id);
    setOrderedIds(newIds);
    localStorage.setItem(MEMBER_ORDER_KEY(groupId), JSON.stringify(newIds));
  };

  const skeletonCount = Math.min(Math.max(0, loadingMemberCount), MAX_MEMBER_SKELETONS);

  return (
    <>
      <div className="LogsMenu" aria-busy={skeletonCount > 0}>
        {isReadOnly && (
          <div
            className={cx("LogsMenu__item LogsMenu__item--zeroeth", {
              "LogsMenu__item--active": displaySummary,
            })}
            onClick={() => onViewSummary()}
          >
            <div className="LogsMenu__item__content">
              <div className="LogsMenu__item__title">Log Group Summary</div>
            </div>
          </div>
        )}
        {!isReadOnly && (
          <div
            className={cx("LogsMenu__item LogsMenu__item--zeroeth", {
              "LogsMenu__item--active": displayAll,
            })}
            onClick={() => onChangeUser()}
          >
            <div className="LogsMenu__item__content">
              <div className="LogsMenu__item__title">Daily Digest</div>
            </div>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={orderedMembers.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            {orderedMembers.map((member) => (
              <SortableMemberItem key={member.id} id={member.id} disabled={!dragEnabled}>
                <LogsMenuItemWithComments
                  displayAll={displayAll}
                  displaySummary={displaySummary}
                  logPosts={logPosts.filter((post) => post.author.id == member.id)}
                  member={member}
                  displayUser={displayUser}
                  user={user}
                  groupId={groupId}
                  onChangeUser={onChangeUser}
                  isSpectator={isSpectator}
                  showDragHandle={dragEnabled}
                />
              </SortableMemberItem>
            ))}
          </SortableContext>
        </DndContext>
        {skeletonCount > 0 && (
          <>
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={`member-skeleton-${i}`}
                className="LogsMenu__item LogsMenu__item--skeleton"
                aria-hidden="true"
              >
                <div className="LogsMenu__item__content">
                  <div className="LogsMenu__skeleton-bar" />
                </div>
              </div>
            ))}
            <span className="sr-only" role="status">
              Loading members…
            </span>
          </>
        )}
      </div>
    </>
  );
};

const SortableMemberItem = ({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={cx("LogsMenu__sortable-item", {
        "LogsMenu__sortable-item--dragging": isDragging,
        "LogsMenu__sortable-item--static": disabled,
      })}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};

type LogsMenuItemProps = {
  displayAll: boolean;
  displaySummary: boolean;
  member: SerializedMember;
  logPosts: LogPost[];
  displayUser: UserData | null | undefined;
  user: UserData | undefined;
  groupId: string;
  onChangeUser: (user?: unknown) => void;
  isSpectator: boolean;
  showDragHandle: boolean;
};

// Separate component to handle individual member's comment checking
const LogsMenuItemWithComments = ({
  displayAll,
  displaySummary,
  member,
  logPosts,
  displayUser,
  user,
  groupId: _groupId,
  onChangeUser,
  isSpectator,
  showDragHandle,
}: LogsMenuItemProps) => {
  const hasUnreadComments = useMemo(() => {
    if (isSpectator) return false;

    // Includes your own log: the author is auto-subscribed to their posts, so new
    // comments on your posts surface here too (the post bell, handled separately,
    // still never shows for your own log).
    const memberPosts = logPosts || [];
    return memberPosts.some((post) => postHasUnreadComments(post, user));
  }, [isSpectator, logPosts, user, member.id]);

  const isOwnItem = member?.id === user?.id;
  // You're actively viewing this member's single log (not the digest or summary), so
  // suppress its nav badges since you're already looking at it. In digest/summary mode
  // displayUser may still point at you, so those must not count as "viewing" — otherwise
  // your own item never shows its speech badge on the default Daily Digest view.
  const isViewingThisMember = !displaySummary && !displayAll && displayUser?.id === member?.id;

  const badgeInput = {
    isSpectator,
    isOwnItem,
    isViewingThisMember,
    memberHasUnreadPosts: member.hasUnreadPosts,
  };

  return (
    <div
      className={cx("LogsMenu__item", {
        "LogsMenu__item--active": isViewingThisMember,
        "LogsMenu__item--first": isOwnItem,
      })}
      onClick={() => onChangeUser(member)}
    >
      {showDragHandle && (
        <span className="LogsMenu__item__dragHandle" aria-hidden="true">
          ⣿
        </span>
      )}
      {shouldShowPostBell(badgeInput) && <Icon type="notification" />}
      {shouldShowCommentBadge({ ...badgeInput, hasUnreadComments }) && (
        <Icon type={"speech"} size={18} />
      )}
      <div className="LogsMenu__item__content">
        <div className="LogsMenu__item__title">{member?.displayName}</div>
        {member?.displayLocation && (
          <div className="LogsMenu__item__subtitle">({member?.displayLocation})</div>
        )}
      </div>
    </div>
  );
};

export default LogsMenu;
