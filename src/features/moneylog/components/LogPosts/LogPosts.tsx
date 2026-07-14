import cx from "classnames";
import { Dispatch, Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allTimezones, useTimezoneSelect } from "react-timezone-select";
import dayjs from "dayjs";

import MDEditor from "@uiw/react-md-editor";

import { Currency, LogPost } from "@/types/user";
import { useCurrentUser } from "@/contexts";

import { useExternalLinkHandler } from "@/hooks/useExternalLinkHandler";
import { useLogPostQuery } from "@/hooks/useLogPostQuery";
import { useDisableScroll } from "@/hooks/useDisableScroll";
import { useUserQuery } from "@/hooks/useUserQuery";
import { UserData } from "@/hooks/useGetUserInfo";
import { useReadTracking } from "@/hooks/useReadTracking";
import { useGetComments } from "@/hooks/useGetLogPostComments";
import { commentsAreUnseen, postHasUnreadComments } from "@/utils/unread";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Icon, { IconText } from "@/components/Icon";
import LogPostEditor from "./LogPostEditor";
import LogPostComments from "./LogPostComments";

type LogPostsProps = {
  user: UserData;
  groupId: string;
  userId: string;
  logs: LogPost[];
  isCreateNewEntry: boolean;
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>;
  isMyLog: boolean;
  isReadOnly: boolean;
  isPostingClosed?: boolean;
  isSpectator?: boolean;
  // Older-post lazy loading: whether more history exists beyond the loaded window,
  // whether an expansion is currently in flight, and how to request the next page.
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
};

type LogPostProps = {
  user: UserData;
  groupId: string;
  post: LogPost;
  selectedPostId: string | null;
  setSelectedPost: Dispatch<React.SetStateAction<LogPost | null>>;
  setCurrentlyEditingPostId: Dispatch<React.SetStateAction<string | null>>;
  isMyLog: boolean;
  isDigestMode: boolean;
  onOpenComments: (post: LogPost, hasUnreadComments: boolean) => void;
  isReadOnly: boolean;
  isPostingClosed?: boolean;
  isSummaryView?: boolean;
};

type DateBanner = {
  isFuture: boolean;
  type: "week" | "day";
  text: string;
  total: { [key: string]: number };
  runningTotal: { [key: string]: number };
  _isBanner: boolean;
};

export const CURRENCIES: Array<Currency> = [
  "JPY",
  "USD",
  "CAD",
  "KRW",
  "CNY",
  "EUR",
  "GBP",
  "NTD",
  "AUD",
  "MYR",
];

export const useUserTimezone = (date: string | Date | number, userTimezone?: string) => {
  return dayjs(date).tz(userTimezone || dayjs.tz.guess());
};

// Local alias so usages inside callbacks/memos don't trigger rules-of-hooks
const toTz = useUserTimezone;

const LogPostItemComponent = ({
  user,
  groupId,
  post,
  selectedPostId,
  setSelectedPost,
  setCurrentlyEditingPostId,
  isMyLog = false,
  isDigestMode = false,
  onOpenComments,
  isReadOnly = false,
  isPostingClosed = false,
  isSummaryView = false,
}: LogPostProps) => {
  const postRef = useRef<HTMLDivElement>(null);
  const { user: loggedInUser } = useCurrentUser();
  const [isShowDeleteWarning, setIsShowDeleteWarning] = useState(false);
  const [showPinWarning, setShowPinWarning] = useState(false);

  const { parseTimezone } = useTimezoneSelect({ labelStyle: "original", timezones: allTimezones });

  const isPinned = useMemo(() => {
    return post.id === user?.pinnedPosts?.[groupId]?.pinnedPost;
  }, [user, post]);

  const hasUnreadComments = useMemo(
    () => postHasUnreadComments(post, loggedInUser),
    [post, loggedInUser],
  );

  useEffect(() => {
    if (postRef.current) {
      postRef.current.focus();
    }
  }, []);

  useExternalLinkHandler(postRef, [post]);

  const postTime = useMemo(() => {
    if (!isDigestMode) {
      if (post.timezone) {
        return toTz(post.postDate?.seconds * 1000, post.timezone).format("HH:mm");
      } else {
        return toTz(post.postDate?.seconds * 1000, user?.timezone).format("HH:mm");
      }
    } else {
      // use relative time 'X ago'
      return dayjs().to(dayjs(post.postDate?.seconds * 1000));
    }
  }, [post]);
  const hoverTimeInfo = useMemo(() => {
    if (!isDigestMode) {
      return `Posted on ${toTz(post.createdAt?.seconds * 1000, user?.timezone).format("ddd D MMM YYYY HH:mm")}`;
    } else {
      const timezone = post?.timezone ?? user?.timezone ?? dayjs.tz.guess();

      return `${toTz(post.postDate?.seconds * 1000, timezone).format("HH:mm")} (${parseTimezone(timezone).abbrev})`;
    }
  }, [post, user]);

  const { deleteLogPost } = useLogPostQuery();
  const { updatePinnedPost } = useUserQuery();

  const handleDeletePost = async (postId: string) => {
    if (!postId) {
      return;
    }

    try {
      await deleteLogPost.mutate({
        logPostId: postId,
      });

      if (selectedPostId === postId) {
        setSelectedPost(null);
      }
    } catch (err) {
      console.error("Failed to delete log post:", err);
    }
  };

  const handlePinPost = async (postId: string) => {
    if (!postId) {
      return;
    }

    try {
      await updatePinnedPost.mutate({
        userId: user.id,
        logGroupId: groupId,
        postId: isPinned ? "none" : postId,
      });

      setShowPinWarning(false);
    } catch (err) {
      console.error("Failed to pin log post:", err);
    }
  };

  const handleOpenComments = () => {
    onOpenComments(post, hasUnreadComments); // Use the passed handler
  };

  useEffect(() => {
    if (selectedPostId === post.id) {
      scrollPostToTop(postRef, isSummaryView ? ".LogsSummary" : ".LogPosts__posts");
    }
  }, [selectedPostId]);

  return (
    <>
      <div
        className={cx("LogPosts__posts__item", {
          "LogPosts__posts__item--selected": selectedPostId === post.id,
          "LogPosts__posts__item--pinned": isPinned && !isDigestMode,
        })}
        ref={postRef}
      >
        {!isPinned && (
          <>
            <div className="LogPosts__posts__item__header">
              <div
                className="LogPosts__posts__itemhandleOpenComments__header__left LogPosts__posts__item__date"
                title={hoverTimeInfo}
              >
                <IconText type="clock" text={postTime} />
              </div>
              <div className="LogPosts__posts__item__header__center LogPosts__posts__item__amount">
                {post.amount?.toLocaleString()} {post.currency}
              </div>
              <div className="LogPosts__posts__item__header__right LogPosts__posts__item__comments">
                <IconText
                  type={hasUnreadComments ? "speech-filled" : "speech"}
                  text={(post?.commentCount ?? 0).toLocaleString()}
                  size={hasUnreadComments ? 16 : 18}
                  className="handler"
                  onClick={handleOpenComments}
                />
              </div>
            </div>
            {isDigestMode && user && (
              <div className="LogPosts__posts__item__header">
                <div className="LogPosts__posts__item__header__left">
                  <Icon type={"user"} />
                  {user.displayName} {user.displayLocation && <>({user.displayLocation})</>}
                </div>
              </div>
            )}
            {!isDigestMode && post.timezone && post.timezone !== user.timezone && (
              <div className="LogPosts__posts__item__header">
                <div className="LogPosts__posts__item__header__left LogPosts__posts__item__date TimezoneSetter">
                  {parseTimezone(post.timezone).label}
                </div>
              </div>
            )}
          </>
        )}
        <div className="LogPosts__posts__item__body">
          <div
            className="LogPosts__posts__item__content"
            data-color-mode={isPinned && !isDigestMode ? "dark" : "light"}
          >
            <MDEditor.Markdown source={post.content} />
          </div>
          {post.imagesProcessing && (
            <div className="LogPost__images LogPost__images--processing">
              <div className="LogPost__images__skeleton" />
            </div>
          )}
          {!post.imagesProcessing && post.images && post.images.length > 0 && (
            <div className="LogPost__images">
              {post.images.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="LogPost__images__img"
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          )}
        </div>
        {!isPostingClosed && !isReadOnly && isMyLog && (
          <>
            <div className="LogPosts__posts__item__footer">
              <div className="LogPostMenu">
                {!isDigestMode && (
                  <IconText
                    className={cx("handler LogPostMenu__item", {
                      "LogPostMenu__item--active": isPinned && !isDigestMode,
                    })}
                    type="pin"
                    size={16}
                    onClick={
                      isPinned && !isDigestMode
                        ? () => handlePinPost(post.id)
                        : () => setShowPinWarning(true)
                    }
                  />
                )}
                <IconText
                  className="handler LogPostMenu__item"
                  type="pencil"
                  size={16}
                  onClick={() => setCurrentlyEditingPostId(post.id)}
                />
                <IconText
                  className="handler LogPostMenu__item"
                  type="trash"
                  onClick={() => setIsShowDeleteWarning(true)}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <Modal isOpen={isShowDeleteWarning} onClose={() => setIsShowDeleteWarning(false)}>
        <Modal.Header title={"Warning"}>Warning</Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to <strong>delete</strong> this post?
          </p>
        </Modal.Body>
        <Modal.Actions>
          <Button
            onClick={() => handleDeletePost(post.id)}
            text="Delete"
            buttonStyle="primary-border"
          />
          <Modal.CancelButton text="Nevermind" />
        </Modal.Actions>
      </Modal>
      <Modal isOpen={showPinWarning} onClose={() => setShowPinWarning(false)}>
        <Modal.Header title={"Warning"}>Warning</Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to <strong>pin</strong> this post?
          </p>
          <p>Your currently pinned post will return to being a regular post.</p>
        </Modal.Body>
        <Modal.Actions>
          <Button onClick={() => handlePinPost(post.id)} text="Pin" buttonStyle="primary-border" />
          <Modal.CancelButton text="Nevermind" />
        </Modal.Actions>
      </Modal>
    </>
  );
};

// Each item renders a markdown body via MDEditor, which is comparatively expensive to
// re-parse. Without memoization, any list-level state change (selecting a post, opening
// comments, editing) re-renders every item. The comparator below skips a re-render when
// nothing this item displays has changed — crucially, it collapses the shared
// `selectedPostId` scalar to a per-item "am I selected?" boolean, so a selection change
// only re-renders the two items whose selected-state actually flips, not the whole list.
// Callbacks are compared by reference (callers pass stable, ref-backed handlers) so a
// skipped item can never retain a stale closure. Any new render-affecting prop must be
// added here too.
export const arePostItemPropsEqual = (prev: LogPostProps, next: LogPostProps): boolean =>
  prev.post === next.post &&
  prev.user === next.user &&
  prev.groupId === next.groupId &&
  prev.setSelectedPost === next.setSelectedPost &&
  prev.setCurrentlyEditingPostId === next.setCurrentlyEditingPostId &&
  prev.onOpenComments === next.onOpenComments &&
  prev.isMyLog === next.isMyLog &&
  prev.isDigestMode === next.isDigestMode &&
  prev.isReadOnly === next.isReadOnly &&
  prev.isPostingClosed === next.isPostingClosed &&
  prev.isSummaryView === next.isSummaryView &&
  (prev.selectedPostId === prev.post.id) === (next.selectedPostId === next.post.id);

export const LogPostItem = memo(LogPostItemComponent, arePostItemPropsEqual);

const LogPosts = memo(
  ({
    groupId,
    user,
    userId,
    logs,
    isCreateNewEntry = false,
    isCreateNewEntrySet,
    isMyLog = false,
    isReadOnly = false,
    isPostingClosed = false,
    isSpectator = false,
    hasMore = false,
    isLoadingMore = false,
    onLoadMore,
  }: LogPostsProps) => {
    const [isWeeklyView, _isWeeklyViewSet] = useState(false);
    const { markCommentsAsViewedFn } = useUserQuery();
    const { user: loggedInUser } = useCurrentUser();
    const { trackUserAction } = useReadTracking();

    const calendarMarkedPosts = useMemo(() => {
      // console.log('calendarMarkedPosts updating')
      // console.log(user.pinnedPosts?.[groupId]?.pinnedPost)

      const displayRows: Array<LogPost | DateBanner> = [];
      const now = dayjs().tz(user?.timezone || dayjs.tz.guess());
      let currentWeekStart: dayjs.Dayjs | null = null;
      let currentDay: number | null = null;
      const runningTotals: { [key: string]: number } = {};
      let weeklyTotals: { [key: string]: number } = {};
      let dailyTotals: { [key: string]: number } = {};

      logs?.forEach((post) => {
        if (post.id != user.pinnedPosts?.[groupId]?.pinnedPost) {
          const logPostDate = toTz(
            post?.postDate?.seconds * 1000,
            post?.timezone ?? user?.timezone,
          );
          const postWeekStart = logPostDate.startOf("week"); // Gets Monday of that week

          if (!(post.currency in runningTotals)) {
            runningTotals[post.currency] = 0;
          }
          runningTotals[post.currency] += Number(post.amount);

          // Check if we've moved to a new week
          if (!currentWeekStart || !postWeekStart.isSame(currentWeekStart)) {
            currentWeekStart = postWeekStart;
            currentDay = null; // Reset day tracking for new week
            weeklyTotals = {}; // Reset current weekly totals

            // Calculate weeks ago
            const weeksAgo = now.startOf("week").diff(postWeekStart, "week");
            const weekText =
              weeksAgo === 0
                ? "This week"
                : weeksAgo === 1
                  ? "1 week ago"
                  : weeksAgo < 0
                    ? "Upcoming"
                    : `${weeksAgo} weeks ago`;

            displayRows.push({
              isFuture: weeksAgo < 0,
              text: weekText,
              type: "week",
              _isBanner: true,
              runningTotal: runningTotals,
              total: weeklyTotals,
            });
          }

          // Accumulate weekly totals
          if (!(post.currency in weeklyTotals)) {
            weeklyTotals[post.currency] = 0;
          }
          weeklyTotals[post.currency] += Number(post.amount);

          // Check if we've moved to a new day within the week
          if (logPostDate.day() !== currentDay) {
            currentDay = logPostDate.day();
            dailyTotals = {};

            displayRows.push({
              text: logPostDate.format("ddd D MMM YYYY"),
              type: "day",
              _isBanner: true,
              runningTotal: runningTotals,
              total: dailyTotals,
              isFuture: now.diff(logPostDate) < 0,
            });
          }

          // Accumulate daily totals
          if (!(post.currency in dailyTotals)) {
            dailyTotals[post.currency] = 0;
          }
          dailyTotals[post.currency] += Number(post.amount);
        }

        displayRows.push(post);
      });

      return displayRows;
    }, [logs]);

    const [selectedPost, setSelectedPost] = useState<LogPost | null>(null);
    const [currentlyEditingPostId, setCurrentlyEditingPostId] = useState<string | null>(null);
    const [shouldForceFresh, setShouldForceFresh] = useState(false);

    // Mirror the current selection so the memoized handler below can read it without
    // closing over it — keeping the handler reference-stable across selection changes,
    // which is what lets memoized LogPostItems skip re-rendering.
    const selectedPostRef = useRef(selectedPost);
    selectedPostRef.current = selectedPost;

    useDisableScroll(!!selectedPost);

    const {
      data: comments,
      isLoading: isLoadingComments,
      isSuccess: isSuccessComments,
      refreshComments,
    } = useGetComments({
      logPostId: selectedPost?.id ?? null,
      forceFresh: shouldForceFresh,
    });

    const postEditorRef = useRef<HTMLDivElement>(null);
    const postsContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

    // Latest paging inputs, read by the (deliberately stable) observer below so it
    // never has to re-attach mid-scroll.
    const loadMoreRef = useRef(onLoadMore);
    const hasMoreRef = useRef(hasMore);
    const isLoadingMoreRef = useRef(isLoadingMore);
    loadMoreRef.current = onLoadMore;
    hasMoreRef.current = hasMore;
    isLoadingMoreRef.current = isLoadingMore;

    const showLoadMore = hasMore || isLoadingMore;

    // Auto-load the next page of older posts once the bottom sentinel scrolls into
    // view. The observer stays attached for the life of the sentinel and fires only on
    // intersection *changes*, so a page that adds no posts for this member (sentinel
    // never leaves view) won't retrigger — the visible "load older posts" button lets
    // the user continue in that case, keeping reads bounded to one page per action.
    useEffect(() => {
      const sentinel = loadMoreSentinelRef.current;
      if (!sentinel) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (
            entries.some((entry) => entry.isIntersecting) &&
            hasMoreRef.current &&
            !isLoadingMoreRef.current
          ) {
            loadMoreRef.current?.();
          }
        },
        { root: postsContainerRef.current, rootMargin: "200px" },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [showLoadMore]);

    const handleOpenComments = useCallback(
      (post: LogPost, hasUnreadComments: boolean) => {
        // Always set shouldForceFresh based on whether we're opening a different post
        // or if the same post has unread comments
        const isNewPost = selectedPostRef.current?.id !== post.id;
        const shouldRefresh = (isNewPost || hasUnreadComments) && !isReadOnly;

        setShouldForceFresh(shouldRefresh);
        setSelectedPost(post);
      },
      [isReadOnly],
    );

    useEffect(() => {
      isCreateNewEntrySet(false);
    }, []);

    useEffect(() => {
      if (isCreateNewEntry) {
        postEditorRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [isCreateNewEntry, postEditorRef]);

    useEffect(() => {
      setSelectedPost(null);
      setShouldForceFresh(false);
    }, [userId]);

    useEffect(() => {
      if (!selectedPost) {
        setShouldForceFresh(false);
      }
    }, [selectedPost]);

    useEffect(() => {
      // Not gated on isReadOnly: opening a post on a completed group must still be
      // able to clear a stuck comment notification. The commentsAreUnseen guard makes
      // this a one-time write (and reads nothing beyond already-loaded post data).
      if (
        !isSpectator &&
        loggedInUser &&
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
        <div
          className={cx("LogPosts", {
            "LogPosts--weekly": isWeeklyView,
          })}
        >
          <div
            ref={postsContainerRef}
            className={cx("LogPosts__posts", {
              "LogPosts__posts--weekly": isWeeklyView,
              "disable-scroll": selectedPost,
            })}
          >
            {/*{false && calendarMarkedPosts?.length > 0 && <>
            <div className="LogPosts__menu">
              <Button
                className={"LogPosts__menu__button"}
                text="Daily"
                onClick={() => isWeeklyViewSet(false)}
                isSelected={!isWeeklyView}
                size="md"
                buttonStyle="primary-border"
              />
              <Button
                className={"LogPosts__menu__button"}
                text="Weekly"
                onClick={() => isWeeklyViewSet(true)}
                isSelected={isWeeklyView}
                size="md"
                buttonStyle="primary-border"
              />
            </div>
          </>}*/}

            {isCreateNewEntry && !isSpectator && (
              <LogPostEditor
                ref={postEditorRef}
                type="new"
                groupId={groupId}
                userId={userId}
                isCreateNewEntrySet={isCreateNewEntrySet}
                setCurrentlyEditingPostId={setCurrentlyEditingPostId}
              />
            )}

            {calendarMarkedPosts?.length > 0 &&
              calendarMarkedPosts?.map((item: LogPost | DateBanner, i) => {
                if ("_isBanner" in item && item._isBanner) {
                  const currencyKeys = Object.keys(item?.total);
                  const formattedTotals = currencyKeys.map(
                    (x) => `${item?.total[x]?.toLocaleString()} ${x}`,
                  );

                  if (item.isFuture) return;

                  return (
                    <div
                      className={cx("LogPosts__posts__banner LogPosts__posts__item__header", {
                        "LogPosts__posts__banner--weekly-view": isWeeklyView,
                        "LogPosts__posts__banner--week": item.type == "week",
                      })}
                      key={`banner-${i}`}
                    >
                      <div className="LogPosts__posts__banner__left">{item?.text}</div>
                      <div className="LogPosts__posts__banner__center">
                        {formattedTotals?.map((x) => (
                          <span key={`${i}-${x}`}>{x}</span>
                        ))}
                      </div>
                      <div></div>
                    </div>
                  );
                } else {
                  if (currentlyEditingPostId === (item as LogPost).id) {
                    return (
                      <LogPostEditor
                        key={(item as LogPost).id}
                        type={"edit"}
                        postId={(item as LogPost).id}
                        groupId={groupId}
                        userId={userId}
                        isCreateNewEntrySet={isCreateNewEntrySet}
                        setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                        content={(item as LogPost).content}
                        amount={(item as LogPost).amount}
                        currency={(item as LogPost).currency}
                        date={(item as LogPost).postDate?.seconds * 1000}
                        isPinned={
                          currentlyEditingPostId ===
                          (isMyLog ? loggedInUser : user)?.pinnedPosts?.[groupId]?.pinnedPost
                        }
                        timezone={(item as LogPost).timezone ?? undefined}
                      />
                    );
                  }

                  return (
                    <Fragment key={(item as LogPost).id}>
                      <LogPostItem
                        user={(isMyLog ? loggedInUser : undefined) ?? user}
                        groupId={groupId}
                        post={item as LogPost}
                        isMyLog={isMyLog}
                        isReadOnly={isReadOnly}
                        isPostingClosed={isPostingClosed}
                        isDigestMode={false}
                        selectedPostId={selectedPost?.id ?? null}
                        setSelectedPost={setSelectedPost}
                        setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                        onOpenComments={handleOpenComments}
                      />
                      {i == calendarMarkedPosts?.length - 1 && (
                        <div
                          className={cx("LogPosts__posts__filler", {
                            "LogPosts__posts__filler--active": selectedPost?.id,
                          })}
                        ></div>
                      )}
                    </Fragment>
                  );
                }
              })}
            {calendarMarkedPosts?.length == 0 && (
              <div className="LogPosts__error">No log entries to display!</div>
            )}
            {showLoadMore && (
              <div className="LogPosts__loadMore" ref={loadMoreSentinelRef}>
                {isLoadingMore ? (
                  <span className="LogPosts__loadMore__status" role="status">
                    Loading older posts…
                  </span>
                ) : (
                  <Button
                    text="Load older posts"
                    size="md"
                    buttonStyle="primary-border"
                    onClick={() => onLoadMore?.()}
                  />
                )}
              </div>
            )}
          </div>
        </div>
        <div className="LogPostComments">
          {selectedPost && (
            <LogPostComments
              currentLogAuthorId={selectedPost.author.id}
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
  },
);

export default LogPosts;

function scrollPostToTop(postRef: React.RefObject<HTMLDivElement>, containerClass: string) {
  setTimeout(() => {
    const logPostsContainer = document.querySelector(containerClass);
    const postElement = postRef.current;

    if (logPostsContainer && postElement) {
      const containerRect = logPostsContainer.getBoundingClientRect();
      const postRect = postElement.getBoundingClientRect();

      const scrollTop = logPostsContainer.scrollTop + (postRect.top - containerRect.top);

      logPostsContainer.scrollTo({
        top: scrollTop,
        behavior: "smooth",
      });
    }
  }, 100);
}
