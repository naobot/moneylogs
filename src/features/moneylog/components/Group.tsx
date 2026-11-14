import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "@/utils/configuredDayjs";
import {
  personalStart,
  personalEnd,
  absoluteEnd,
  timeUntilReadOnly,
} from "@/utils/groupBoundaries";

import { useCurrentUser } from "@/contexts";

import CopyTextArea from "@/features/layout/components/CopyTextArea";
import LogsMenu from "@/features/moneylog/components/LogsMenu";
import { ActiveLog } from "@/features/moneylog/components/ActiveLog";
import { useGetGroupUsers } from "@/hooks/useGetGroupUsers";
import { UserData } from "@/hooks/useGetUserInfo";
import { Group as GroupType } from "@/types/user";
import { useReadTracking } from "@/hooks/useReadTracking";
import { useGetLogPosts } from "@/hooks/useGetLogPosts";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useNow } from "@/hooks/useNow";
import { memberHasUnreadPosts } from "@/utils/unread";
import { readPostLink, resolvePostLink, withoutPostLink } from "@/utils/postLink";
import { useToastContext } from "@/hooks/useToastContext";

import Icon, { IconText } from "@/components/Icon";
import LogsSummary from "./LogsSummary/LogsSummary";
import Modal from "@/components/Modal";
import TutorialTooltip from "@/components/TutorialTooltip";
import { useTutorial } from "@/contexts/TutorialContext";
import LogActionsModal from "@/features/logActions/LogActionsModal";
import { creatorUid } from "@/utils/logOwnership";
import { useDateFormat } from "@/utils/dateFormat";
import { MemberNamesContext } from "./LogPosts/memberNames";
import type { PostFocus } from "./LogPosts/LogPosts";
import { publicHost, publicUrl, storage } from "@/platform";
import ShareLinkButton from "@/features/layout/components/ShareLinkButton";

const agreeWarningKey = (groupId: string) => `ML__${groupId}__agreeWarning`;
const agreedToEndWarning = (groupId: string) => storage.get(agreeWarningKey(groupId)) === "1";

export const Group = ({
  group,
  groupId,
  isSpectator = false,
}: {
  group: GroupType;
  groupId: string;
  isSpectator?: boolean;
}) => {
  const { user: loggedInUser } = useCurrentUser();
  // const { pathname } = useLocation()
  const { updateViewTrackingFn } = useUserQuery();
  const { trackUserAction } = useReadTracking();
  const { formatShortDate, formatTime, formatDateTime } = useDateFormat();
  const { showNewEntryTip, dismissNewEntryTip, onNewEntryClicked } = useTutorial();
  const { showToast } = useToastContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Ticking clock, so the boundary crossings below re-evaluate on their own rather
  // than freezing at whatever they were when the page first rendered.
  const now = useNow();

  // Default view: Daily Digest while the group is active, Log Group Summary once
  // it has fully ended (see the reset effect below, which is the source of truth)
  const [displayAll, setDisplayAll] = useState(() => absoluteEnd(group).isAfter(dayjs()));
  const [displayUser, setDisplayUser] = useState<UserData | null>(
    isSpectator ? null : (loggedInUser ?? null),
  );
  const [displaySummary, setDisplaySummary] = useState(() => absoluteEnd(group).isBefore(dayjs()));
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEndWarningModal, setShowEndWarningModal] = useState(false);
  // A post linked from a notification (?post=&comment=), once it's been found.
  const [postFocus, setPostFocus] = useState<PostFocus | null>(null);
  // The group whose default view a followed link replaced, so the reset below leaves
  // that view alone (the user's profile can land after the link was followed).
  const linkedGroupRef = useRef<string | null>(null);

  const isFutureGroup = useMemo(() => {
    return personalStart(group, loggedInUser?.timezone).isAfter(now);
  }, [group, loggedInUser?.timezone, now]);

  const endingSoon = useMemo(() => {
    const end = personalEnd(group, loggedInUser?.timezone);
    return end.isAfter(now) && end.diff(now, "second") < 86400;
  }, [group, loggedInUser?.timezone, now]);
  // Read on every render: agreeing only writes storage, with no state change of its own.
  const neverViewedWarningModal = endingSoon && !agreedToEndWarning(groupId);

  const [isCreateNewEntry, isCreateNewEntrySet] = useState(false);

  const {
    users: members,
    isLoading: isLoadingMembers,
    userIdToDocRefMap,
  } = useGetGroupUsers(groupId);

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName])),
    [members],
  );

  // Personal end: this user's posting window has closed
  const isPostingClosed = useMemo(() => {
    return personalEnd(group, loggedInUser?.timezone).isBefore(now);
  }, [group, loggedInUser?.timezone, now]);

  // Absolute end: the group is fully closed for all users in all timezones
  const isReadOnly = useMemo(() => {
    return absoluteEnd(group).isBefore(now);
  }, [group, now]);

  const logPostRes = useGetLogPosts({ groupId, isArchived: isReadOnly });

  const memberIds = useMemo(() => {
    if (!members) return [];
    return members.map((ref) => ref.id);
  }, [groupId, members]);

  const isActiveLogMyLog = useMemo(() => {
    return loggedInUser?.id === displayUser?.id;
  }, [loggedInUser, displayUser]);

  const userTz = loggedInUser?.timezone || dayjs.tz.guess();
  const displayStart = useMemo(
    () =>
      group.startWallClock ? dayjs.tz(group.startWallClock, userTz) : dayjs(group.start.toDate()),
    [group, userTz],
  );
  const displayEnd = useMemo(
    () => (group.endWallClock ? dayjs.tz(group.endWallClock, userTz) : dayjs(group.end.toDate())),
    [group, userTz],
  );

  useEffect(() => {
    if (linkedGroupRef.current === groupId) return;
    if (isReadOnly) {
      // Completed logs open on the group summary
      setDisplayUser(null);
      setDisplayAll(false);
      setDisplaySummary(true);
      return;
    }
    // Active logs open on the Daily Digest
    if (isSpectator) {
      setDisplayAll(true);
      setDisplayUser(null);
    } else if (loggedInUser) {
      setDisplayUser(loggedInUser);
      setDisplayAll(true);
    }
    setDisplaySummary(false);
  }, [loggedInUser?.id, groupId, isSpectator, isReadOnly]);

  useEffect(() => {
    isCreateNewEntrySet(false);
    setShowInviteModal(false);
  }, [group]);

  // Follow a post link: page through older posts until it turns up, open its author's
  // log, and hand the post (and comment) to LogPosts to scroll to. Then drop the params,
  // so going back or switching members doesn't jump again.
  const postLink = useMemo(() => readPostLink(searchParams), [searchParams]);
  const { posts, hasMore, isLoadingMore, loadMore } = logPostRes;
  useEffect(() => {
    if (!postLink || !logPostRes.isSuccess || isLoadingMembers) return;
    const found = resolvePostLink(posts, postLink.postId, { hasMore, isLoadingMore });
    if (found.status === "waiting") return;
    if (found.status === "load-more") {
      loadMore();
      return;
    }
    setSearchParams((prev) => withoutPostLink(prev), { replace: true });
    if (found.status === "missing") {
      showToast("That post isn't in this log any more.", "error");
      return;
    }
    const author = members.find((m) => m.id === found.post.author.id);
    linkedGroupRef.current = groupId;
    setDisplaySummary(false);
    if (author) {
      setDisplayUser(author as unknown as UserData);
      setDisplayAll(false);
      setPostFocus({ ...postLink, key: Date.now() });
    } else {
      // The author has left the log: their posts still show in the digest.
      setDisplayAll(true);
    }
  }, [postLink, logPostRes.isSuccess, posts, hasMore, isLoadingMore, isLoadingMembers, members]);

  useEffect(() => {
    if (!agreedToEndWarning(groupId)) {
      setShowEndWarningModal(endingSoon);
    }
  }, [endingSoon]);

  useEffect(() => {
    trackUserAction("view_group", {
      user_id: loggedInUser?.id,
      group_id: groupId,
    });
  }, [groupId, trackUserAction]);

  useEffect(() => {
    const updateViewTracking = async () => {
      // Runs on completed (read-only) groups too: a post notification left unread
      // when the group ended can still be cleared by viewing. The memberHasUnreadPosts
      // guard below keeps this to a single write, so it never returns.
      if (isSpectator) return;
      // Only track if we have all required data and user is viewing someone else's logs
      if (!userIdToDocRefMap || userIdToDocRefMap.size === 0) return;
      if (
        !loggedInUser?.userId ||
        !groupId ||
        !displayUser?.userId ||
        !memberIds.includes(displayUser?.id)
      )
        return;

      const viewingUserDocRefId = userIdToDocRefMap.get(loggedInUser.userId);
      const viewedUserDocRefId = userIdToDocRefMap.get(displayUser.userId);

      if (!viewingUserDocRefId || !viewedUserDocRefId) {
        console.error("User not found in map", { viewingUserDocRefId, viewedUserDocRefId });
        return;
      }

      // Your own log never shows a post bell, so tracking your own views is pointless.
      if (viewedUserDocRefId === viewingUserDocRefId) return;

      // Only write when there's genuinely a new post to mark as read; idly clicking
      // back to a member you're caught up on shouldn't touch the database. This also
      // reads false while our own write is still in flight, so the re-runs triggered by
      // `members` landing can't queue a duplicate write.
      const viewedMember = members.find((m) => m.id === viewedUserDocRefId);
      if (
        !memberHasUnreadPosts({
          member: viewedMember,
          viewTracking: loggedInUser.viewTracking,
          groupId,
        })
      ) {
        return;
      }

      try {
        await updateViewTrackingFn({
          userId: viewingUserDocRefId,
          logGroupId: groupId,
          viewedUserId: viewedUserDocRefId,
        });

        trackUserAction("update_user_last_viewed", {
          user_id: loggedInUser?.id,
          group_id: groupId,
        });
      } catch (error) {
        console.error("Failed to update view tracking:", error);
      }
    };

    updateViewTracking();
    // `members` and `userIdToDocRefMap` belong here, not just the ids: useGetGroupUsers
    // paints from a localStorage cache that omits `lastUpdated`, so an early run sees
    // every member as "nothing new" and skips the write. Without these deps the effect
    // never retries once the real snapshot lands, and the bell stays lit for a log the
    // user already read. Both are identity-stable unless the member set really changed.
  }, [displayUser?.userId, loggedInUser?.userId, groupId, members, userIdToDocRefMap]);

  const handleUserChange = (newUser?: unknown) => {
    if (newUser) {
      setDisplayUser(newUser as UserData);
      setDisplayAll(false);
      setDisplaySummary(false);
    } else {
      setDisplayAll(true);
    }

    setTimeout(() => {
      const logPostsContainer = document.querySelector(".LogPosts__posts");

      if (logPostsContainer) {
        logPostsContainer.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  const handleViewSummary = () => {
    setDisplayUser(null);
    setDisplayAll(false);
    setDisplaySummary(true);

    setTimeout(() => {
      const logPostsContainer = document.querySelector(".LogPosts__posts");

      if (logPostsContainer) {
        logPostsContainer.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  return (
    <MemberNamesContext.Provider value={memberNames}>
      <div className="Group">
        <div className="Group__header">
          <div className="Group__header__left">
            <div className="GroupInterval Group__header__item">
              {group && (
                <div className="Group__header__item__time">
                  {formatShortDate(displayStart)} <small>({formatTime(displayStart)})</small> to{" "}
                  {formatShortDate(displayEnd)} <small>({formatTime(displayEnd)})</small>
                </div>
              )}
              {!isPostingClosed && endingSoon && (
                <Icon type="warning" fill="white" onClick={() => setShowEndWarningModal(true)} />
              )}
            </div>
          </div>

          <div className="Group__header__center">
            {displaySummary && (
              <div className="Group__header__item Group__header__title">
                Insights for {group.title}
              </div>
            )}
            {!isPostingClosed &&
              !displayAll &&
              isActiveLogMyLog &&
              !isFutureGroup &&
              !isSpectator && (
                <div
                  className="handler Group__header__item"
                  style={{ position: "relative" }}
                  onClick={() => {
                    isCreateNewEntrySet(true);
                    onNewEntryClicked();
                  }}
                >
                  {showNewEntryTip && (
                    <TutorialTooltip
                      text="Click here to create your first log post"
                      onDismiss={dismissNewEntryTip}
                      position="bottom"
                    />
                  )}
                  <IconText type={"document"} fill={"white"} text="new entry" />
                </div>
              )}
            {/* This user is done posting, but later timezones are still logging, so
                the summary can't be final yet. Takes the "new entry" slot. */}
            {isPostingClosed && !isReadOnly && !isSpectator && !displaySummary && (
              <div className="Group__header__item Group__header__pending">
                Log Summary ready {timeUntilReadOnly(group, now)}
              </div>
            )}
          </div>

          <div className="Group__header__right">
            {!isSpectator && (
              <div className="handler Group__header__item" onClick={() => setShowManageModal(true)}>
                <IconText type={"gear"} fill={"white"} text="manage" />
              </div>
            )}
            {!isPostingClosed &&
              !isSpectator &&
              group?.members?.length < group?.max_participants && (
                <>
                  <div
                    className="handler Group__header__item"
                    onClick={() => {
                      setShowInviteModal(true);
                    }}
                  >
                    <IconText type={"plus"} fill={"white"} text="invite" />
                  </div>
                  <div className="Group__header__item">
                    <small>
                      ({group?.max_participants - group.members?.length} spot
                      {group?.max_participants - group.members?.length > 1 && "s"} left)
                    </small>
                  </div>
                </>
              )}
          </div>
        </div>
        <div className="Group__body">
          {/*{(isLoadingGroup || isLoadingMembers) && <>...</>}*/}
          {logPostRes.isSuccess && !isLoadingMembers && groupId && (
            <>
              <LogsMenu
                logMembers={members}
                logPosts={logPostRes.posts}
                displayAll={displayAll}
                displaySummary={displaySummary}
                displayUser={displayUser}
                onChangeUser={handleUserChange}
                onViewSummary={handleViewSummary}
                groupId={groupId}
                isReadOnly={isReadOnly}
                loadingMemberCount={Math.max(0, (group.members?.length ?? 0) - members.length)}
              />
              {isFutureGroup && (
                <div className="LogPosts">
                  <div className="LogPosts__error">This group log has not begun yet!</div>
                </div>
              )}
              {!isFutureGroup && displaySummary && (
                <LogsSummary
                  group={group}
                  groupMembers={members}
                  logPosts={logPostRes.posts}
                  isLoading={logPostRes.isLoading}
                />
              )}
              {!isFutureGroup && !displaySummary && (displayAll || displayUser) && (
                <ActiveLog
                  group={group}
                  groupId={groupId}
                  groupMembers={members}
                  logPosts={
                    displayAll
                      ? logPostRes.posts
                      : logPostRes.posts.filter((post) => post.author.id == displayUser?.id)
                  }
                  displayAll={displayAll}
                  displayUser={displayUser}
                  userId={displayUser?.userId}
                  isCreateNewEntry={isCreateNewEntry}
                  isCreateNewEntrySet={isCreateNewEntrySet}
                  isMyLog={isActiveLogMyLog}
                  isReadOnly={isReadOnly}
                  isPostingClosed={isPostingClosed}
                  isSpectator={isSpectator}
                  hasMorePosts={logPostRes.hasMore}
                  isLoadingMorePosts={logPostRes.isLoadingMore}
                  onLoadMorePosts={logPostRes.loadMore}
                  postFocus={postFocus}
                />
              )}
            </>
          )}
        </div>
      </div>
      {!isSpectator && groupId && (
        <LogActionsModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          logId={groupId}
          logTitle={group.title}
          kind="social"
          creatorUid={creatorUid(group, "social")}
        />
      )}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header title={"Invite"}>Invite</Modal.Header>
        <Modal.Body>
          <p>
            Send the following URL to those you want to invite to participate in this log group.
          </p>
          <p>Do not share the group URL with anyone you do not want participating!</p>
          <CopyTextArea value={`${publicHost()}/g/${groupId}/invite`} />
          <ShareLinkButton
            title={`Join ${group.title} on moneylogs`}
            url={publicUrl(`/g/${groupId}/invite`)}
          />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Close" />
        </Modal.Actions>
      </Modal>
      {!isPostingClosed && endingSoon && (showEndWarningModal || neverViewedWarningModal) && (
        <Modal isOpen={showEndWarningModal} onClose={() => setShowEndWarningModal(false)}>
          <Modal.Header title={"Warning"}>Warning</Modal.Header>
          <Modal.Body>
            <p>This moneylog group is ending soon!</p>
            <p>
              Your posting window closes at <strong>{formatDateTime(displayEnd)}</strong>.
            </p>
            <p>You can still read and comment for a period after that.</p>
          </Modal.Body>
          <Modal.Actions>
            <Modal.ConfirmButton
              onClick={() => {
                storage.set(agreeWarningKey(groupId), "1");
              }}
              text="OK"
            />
          </Modal.Actions>
        </Modal>
      )}
    </MemberNamesContext.Provider>
  );
};
