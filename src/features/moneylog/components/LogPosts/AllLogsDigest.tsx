import cx from "classnames";
import { Dispatch, Fragment, useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/contexts";
import { LogPost } from "@/types/user";

import { useReadTracking } from "@/hooks/useReadTracking";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useDisableScroll } from "@/hooks/useDisableScroll";
import { useGetComments } from "@/hooks/useGetLogPostComments";
import LogPostEditor from "./LogPostEditor";
import { LogPostItem } from "./LogPosts";
import LogPostComments from "./LogPostComments";
import dayjs from "@/utils/configuredDayjs";
import { FullUserData } from "@/hooks/useGetGroupUsers";
import { UserData } from "@/hooks/useGetUserInfo";
import { commentsAreUnseen } from "@/utils/unread";

const AllLogsDigest = ({
  groupId,
  logs,
  members,
  isCreateNewEntrySet,
  isReadOnly = false,
  isPostingClosed = false,
  isSpectator = false,
}: {
  groupId: string;
  logs: LogPost[];
  // Passed down already-loaded from Group so the digest never renders with an
  // empty member map. Fetching members here instead caused a flash: on the first
  // render the map was empty, so pinned posts weren't filtered out and posts were
  // bucketed by the viewer's timezone rather than each author's.
  members: FullUserData[];
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>;
  isReadOnly: boolean;
  isPostingClosed?: boolean;
  isSpectator?: boolean;
}) => {
  const { markCommentsAsViewedFn } = useUserQuery();
  const { user: loggedInUser } = useCurrentUser();
  const { trackUserAction } = useReadTracking();

  const memberMap = useMemo(() => {
    const result = new Map<string, FullUserData>();

    members.forEach((member) => result.set(member.id, member));

    return result;
  }, [members]);

  const viewerTz = loggedInUser?.timezone || dayjs.tz.guess();

  // Each post belongs to the calendar day of the poster's own timezone:
  // the post's travel override, else the author's profile timezone
  const logsWithDayKeys = useMemo(() => {
    return logs
      .filter((log) => {
        const authorsPinnedPost = memberMap.get(log.author.id)?.pinnedPosts?.[groupId]?.pinnedPost;
        return authorsPinnedPost !== log.id;
      })
      .map((log) => {
        const posterTz = log.timezone ?? memberMap.get(log.author.id)?.timezone ?? viewerTz;
        return {
          log,
          dayKey: dayjs(log.postDate.seconds * 1000)
            .tz(posterTz)
            .format("YYYY-MM-DD"),
        };
      });
  }, [logs, memberMap, groupId, viewerTz]);

  const dayKeys = useMemo(
    () => [...new Set(logsWithDayKeys.map((l) => l.dayKey))].sort(),
    [logsWithDayKeys],
  );

  const today = dayjs().tz(viewerTz).format("YYYY-MM-DD");
  const latestPostDay = dayKeys[dayKeys.length - 1];

  // Land on the most recent day with posts; browse forward up to today (active
  // groups) or the last post day (ended groups). Back-navigation is capped at a
  // single day: commenting on older posts would surface "new comment" indicators
  // for activity that's hard to locate without a dedicated notification page.
  const defaultDay = latestPostDay ?? today;
  const dayBeforeDefault = dayjs(defaultDay).subtract(1, "day").format("YYYY-MM-DD");
  const firstPostDay = dayKeys[0];
  const minDay = firstPostDay && firstPostDay > dayBeforeDefault ? firstPostDay : dayBeforeDefault;
  const maxDay = isReadOnly
    ? defaultDay
    : latestPostDay && latestPostDay > today
      ? latestPostDay
      : today;

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const currentDay = selectedDay ?? defaultDay;

  useEffect(() => {
    setSelectedDay(null);
  }, [groupId]);

  const visibleLogs = useMemo(
    () => logsWithDayKeys.filter((l) => l.dayKey === currentDay).map((l) => l.log),
    [logsWithDayKeys, currentDay],
  );

  const [selectedPost, setSelectedPost] = useState<LogPost | null>(null);
  const [currentlyEditingPostId, setCurrentlyEditingPostId] = useState<string | null>(null);
  const [shouldForceFresh, setShouldForceFresh] = useState(false);

  useDisableScroll(!!selectedPost);

  // Single instance of the comment hook
  const {
    data: comments,
    isLoading: isLoadingComments,
    isSuccess: isSuccessComments,
    refreshComments,
  } = useGetComments({
    logPostId: selectedPost?.id ?? null,
    forceFresh: shouldForceFresh,
  });

  const goToDay = (offset: number) => {
    const target = dayjs(currentDay).add(offset, "day").format("YYYY-MM-DD");
    if (target < minDay || target > maxDay) return;
    setSelectedDay(target);
    setSelectedPost(null);
  };

  const handleOpenComments = (post: LogPost, hasUnreadComments: boolean) => {
    // Always set shouldForceFresh based on whether we're opening a different post
    // or if the same post has unread comments
    const isNewPost = selectedPost?.id !== post.id;
    const shouldRefresh = (isNewPost || hasUnreadComments) && !isReadOnly;

    console.log(
      `👆 opening comments for post ${post.id} (new: ${isNewPost}, unread: ${hasUnreadComments}, refresh: ${shouldRefresh})`,
    );

    setShouldForceFresh(shouldRefresh);
    setSelectedPost(post);
  };

  useEffect(() => {
    setSelectedPost(null);
    setShouldForceFresh(false);
  }, []);

  useEffect(() => {
    if (!selectedPost) {
      setShouldForceFresh(false);
    }
  }, [selectedPost]);

  useEffect(() => {
    if (
      loggedInUser &&
      !isSpectator &&
      selectedPost?.commentCount &&
      selectedPost.commentCount > 0
    ) {
      trackUserAction("view_post", {
        post_id: selectedPost?.id,
        user_id: loggedInUser?.id,
      });

      // Only write when there are actually new comments to mark as read.
      if (commentsAreUnseen(selectedPost, loggedInUser.commentSubscriptions)) {
        markCommentsAsViewedFn({
          userId: loggedInUser.id,
          logPostId: selectedPost.id,
        });
      }
    }
  }, [selectedPost?.id, loggedInUser?.userId, trackUserAction]);

  return (
    <>
      <div className="LogPosts">
        <div
          className={cx("LogPosts__posts", {
            "disable-scroll": selectedPost,
          })}
        >
          <div
            className={cx(
              "LogPosts__posts__banner LogPosts__posts__item__header LogPosts__posts__banner--week",
            )}
          >
            <div className="LogPosts__posts__banner__left"></div>
            <div className="LogPosts__posts__banner__center">
              <div className="DigestNav">
                <button
                  className="DigestNav__arrow"
                  onClick={() => goToDay(-1)}
                  disabled={currentDay <= minDay}
                  aria-label="Previous day"
                >
                  ←
                </button>
                <span>Posts from {dayjs(currentDay).format("ddd D MMM YYYY")}</span>
                <button
                  className="DigestNav__arrow"
                  onClick={() => goToDay(1)}
                  disabled={currentDay >= maxDay}
                  aria-label="Next day"
                >
                  →
                </button>
              </div>
            </div>
            <div></div>
          </div>
          {visibleLogs?.map((item: LogPost, i) => {
            const isMyPost = item.author.id == loggedInUser?.id;
            const authorData = memberMap.get(item.author.id);

            if (currentlyEditingPostId === (item as LogPost).id) {
              return (
                <LogPostEditor
                  key={(item as LogPost).id}
                  type={"edit"}
                  postId={(item as LogPost).id}
                  groupId={groupId}
                  userId={loggedInUser?.userId ?? ""}
                  isCreateNewEntrySet={isCreateNewEntrySet}
                  setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                  content={(item as LogPost).content}
                  amount={(item as LogPost).amount}
                  currency={(item as LogPost).currency}
                  date={(item as LogPost).postDate?.seconds * 1000}
                  timezone={(item as LogPost).timezone ?? undefined}
                />
              );
            }

            return (
              <Fragment key={(item as LogPost).id}>
                <LogPostItem
                  user={(isMyPost && loggedInUser ? loggedInUser : authorData) as UserData}
                  groupId={groupId}
                  post={item as LogPost}
                  isDigestMode={true}
                  isMyLog={isMyPost}
                  isReadOnly={isReadOnly}
                  isPostingClosed={isPostingClosed}
                  selectedPostId={selectedPost?.id ?? null}
                  setSelectedPost={setSelectedPost}
                  setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                  onOpenComments={handleOpenComments}
                />
                {i == visibleLogs.length - 1 && (
                  <div
                    className={cx("LogPosts__posts__filler", {
                      "LogPosts__posts__filler--active": selectedPost?.id,
                    })}
                  ></div>
                )}
              </Fragment>
            );
          })}
          {visibleLogs?.length == 0 && (
            <div className="LogPosts__error">No log entries to display!</div>
          )}
        </div>
      </div>
      <div className="LogPostComments">
        {selectedPost && (
          <LogPostComments
            currentLogAuthorId={selectedPost.author?.id}
            postId={selectedPost.id}
            comments={comments}
            isLoadingComments={isLoadingComments}
            isSuccessComments={isSuccessComments}
            refreshComments={refreshComments}
            isReadOnly={isReadOnly}
            isSpectator={isSpectator}
          />
        )}
      </div>
      {selectedPost && (
        <div
          className="LogPostComments__handler handler"
          onClick={() => setSelectedPost(null)}
        ></div>
      )}
    </>
  );
};

export default AllLogsDigest;
