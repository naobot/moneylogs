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
}

const MEMBER_ORDER_KEY = (groupId: string) => `ML__${groupId}__memberOrder`;

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
}: LogsMenuProps) => {
  const { user } = useCurrentUser();

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
      const memberLastUpdated = member.lastUpdated?.[groupId];
      const userLastViewed = user?.viewTracking?.[groupId]?.[member.id]?.lastViewedAt;

      if (!memberLastUpdated) {
        return { ...member, hasUnreadPosts: false };
      }
      if (!userLastViewed) {
        return { ...member, hasUnreadPosts: true };
      }
      const hasUnreadPosts = memberLastUpdated.seconds > userLastViewed.seconds;

      return { ...member, hasUnreadPosts };
    });
  }, [isSpectator, user?.viewTracking, logMembers, groupId, user?.id]);

  const orderedMembers = useMemo(() => {
    if (orderedIds.length) {
      const idToMember = new Map(serializedMembers.map((m) => [m.id, m]));
      const ordered = orderedIds.flatMap((id) => {
        const m = idToMember.get(id);
        return m ? [m] : [];
      });
      const orderedSet = new Set(orderedIds);
      const newMembers = serializedMembers.filter((m) => !orderedSet.has(m.id));
      return [...ordered, ...newMembers];
    }
    // Default: logged-in user's own entry first
    const myMember = serializedMembers.find((m) => m.id === user?.id);
    const others = serializedMembers.filter((m) => m.id !== user?.id);
    return myMember ? [myMember, ...others] : serializedMembers;
  }, [serializedMembers, orderedIds, user?.id]);

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

  return (
    <>
      <div className="LogsMenu">
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
              <SortableMemberItem key={member.id} id={member.id}>
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
                />
              </SortableMemberItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </>
  );
};

const SortableMemberItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      className={cx("LogsMenu__sortable-item", { "LogsMenu__sortable-item--dragging": isDragging })}
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
}: LogsMenuItemProps) => {
  const hasUnreadComments = useMemo(() => {
    if (isSpectator) return false;
    // Skip checking own posts for comments
    if (member.id === user?.id) return false;

    const memberPosts = logPosts || [];
    return memberPosts.some((post) => {
      if (!post.commentSubscribers || !user?.id) return false;

      // First check: Is the current user subscribed to this post's comments?
      const isSubscribed = post.commentSubscribers.some((subscriber) => subscriber.id === user.id);

      // If not subscribed, no unread indicator
      if (!isSubscribed) return false;

      // If subscribed, check if there are unread comments
      const userLastViewed = user?.commentSubscriptions?.[post.id]?.lastViewedAt;
      return (
        post.latestCommentAt &&
        (!userLastViewed || post.latestCommentAt.seconds > userLastViewed.seconds)
      );
    });
  }, [isSpectator, logPosts, user, member.id]);

  return (
    <div
      className={cx("LogsMenu__item", {
        "LogsMenu__item--active": !displaySummary && !displayAll && displayUser?.id === member?.id,
        "LogsMenu__item--first": member?.id === user?.id,
      })}
      onClick={() => onChangeUser(member)}
    >
      {!isSpectator &&
        member?.id !== user?.id &&
        displayUser?.id !== member?.id &&
        member.hasUnreadPosts && <Icon type="notification" />}
      {!isSpectator &&
        displayUser?.id !== member?.id &&
        (!member.hasUnreadPosts || member?.id === user?.id) &&
        hasUnreadComments && <Icon type={"speech"} size={18} />}
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
