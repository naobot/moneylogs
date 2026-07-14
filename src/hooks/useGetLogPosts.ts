import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
  doc,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { LogPost } from "@/types/user";
import { invalidateCommentCache } from "./useGetLogPostComments";

// Active groups open on a real-time window of the most recent posts. Long-running
// sessions can accumulate far more than this, so the window is grown a page at a
// time via loadMore() (see below) rather than loaded all at once.
const INITIAL_ACTIVE_POST_LIMIT = 200;
const ACTIVE_POST_PAGE_SIZE = 200;

type UseGetLogPostsParams = {
  groupId?: string;
  isArchived?: boolean;
};

type LogPostsState = {
  posts: LogPost[];
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  // True when the most recent window filled its limit, so older posts may still
  // exist beyond it and loadMore() can fetch them.
  hasMore: boolean;
  // True while a loadMore() expansion is in flight (posts already on screen stay put).
  isLoadingMore: boolean;
};

const initialState: LogPostsState = {
  posts: [],
  isLoading: false,
  isSuccess: false,
  isError: false,
  error: undefined,
  hasMore: false,
  isLoadingMore: false,
};

export const useGetLogPosts = ({ groupId, isArchived = false }: UseGetLogPostsParams) => {
  const [state, setState] = useState<LogPostsState>(initialState);
  const [postLimit, setPostLimit] = useState(INITIAL_ACTIVE_POST_LIMIT);
  const previousCommentTimestamps = useRef<Map<string, unknown>>(new Map());

  // Mirror the paging flags so the stable loadMore() below can gate itself without
  // resubscribing on every state change, and so a burst of calls can't stack.
  const hasMoreRef = useRef(state.hasMore);
  const isLoadingMoreRef = useRef(state.isLoadingMore);
  hasMoreRef.current = state.hasMore;
  isLoadingMoreRef.current = state.isLoadingMore;

  // Reset the window whenever we switch group/archive-state. Adjusting state during
  // render (the React-recommended pattern) means the listener effect below sees the
  // reset limit immediately, avoiding a throwaway subscription at the previous limit.
  const listenerKey = `${groupId ?? ""}:${isArchived}`;
  const previousListenerKey = useRef(listenerKey);
  if (previousListenerKey.current !== listenerKey) {
    previousListenerKey.current = listenerKey;
    setPostLimit(INITIAL_ACTIVE_POST_LIMIT);
  }

  useEffect(() => {
    if (!groupId || typeof groupId !== "string") {
      setState(initialState);
      return;
    }

    const groupDocRef = doc(db, "log_groups", groupId);

    if (isArchived) {
      // Archived groups: one-time read of everything, no listener and no paging.
      // Data is immutable once archived so a live WebSocket connection serves no
      // purpose, and there is nothing further to lazily load.
      let cancelled = false;

      setState((prev) => ({ ...prev, isLoading: true }));

      const postsQuery = query(
        collection(db, "log_posts"),
        where("group", "==", groupDocRef),
        orderBy("postDate", "desc"),
      );

      console.log("⬇️ fetching archived log posts (one-time read)");
      getDocs(postsQuery)
        .then((snapshot) => {
          if (cancelled) return;
          console.log(`📄 fetched ${snapshot.size} archived log posts`);
          const posts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as LogPost[];
          setState({
            posts,
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: undefined,
            hasMore: false,
            isLoadingMore: false,
          });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error("❌ error fetching archived log posts:", error);
          setState({
            posts: [],
            isLoading: false,
            isSuccess: false,
            isError: true,
            error,
            hasMore: false,
            isLoadingMore: false,
          });
        });

      return () => {
        cancelled = true;
      };
    }

    // Active groups: real-time listener over the most recent `postLimit` posts. The
    // window grows a page at a time (loadMore) rather than loading unbounded history,
    // keeping the first paint cheap. Because it stays a single contiguous descending
    // query, the loaded range never develops gaps as new posts arrive, and every
    // visible post keeps its real-time updates and comment-notification tracking.
    const isInitialWindow = postLimit === INITIAL_ACTIVE_POST_LIMIT;

    // Initial subscription: full loading state. Expansions: keep posts on screen and
    // only flag isLoadingMore, so the list doesn't flicker back to a skeleton.
    setState((prev) =>
      isInitialWindow
        ? { ...prev, isLoading: true, isLoadingMore: false }
        : { ...prev, isLoadingMore: true },
    );

    const postsQuery = query(
      collection(db, "log_posts"),
      where("group", "==", groupDocRef),
      orderBy("postDate", "desc"),
      limit(postLimit),
    );

    console.log(`🔄 setting up real-time listener on log_posts (limit ${postLimit})`);

    const unsubscribe: Unsubscribe = onSnapshot(
      postsQuery,
      (querySnapshot) => {
        console.log(`📡 received ${querySnapshot.size} log posts from real-time listener`);

        const posts = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as LogPost[];

        // Detect latestCommentAt changes to invalidate comment cache and push notifications.
        // This runs on every snapshot so comment updates on any visible post are caught.
        posts.forEach((post) => {
          const currentLatestCommentAt = post.latestCommentAt;
          const previousLatestCommentAt = previousCommentTimestamps.current.get(post.id);

          if (previousLatestCommentAt && currentLatestCommentAt) {
            const currentTime =
              (currentLatestCommentAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const previousTime =
              (previousLatestCommentAt as { toMillis?: () => number })?.toMillis?.() ?? 0;

            if (currentTime !== previousTime) {
              console.log(
                `🔄 latestCommentAt changed for post ${post.id}, invalidating comment cache`,
              );
              invalidateCommentCache(post.id);
            }
          }

          previousCommentTimestamps.current.set(post.id, currentLatestCommentAt);
        });

        // A full window means there may be older posts still beyond it.
        const hasMore = querySnapshot.size >= postLimit;

        setState({
          posts,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: undefined,
          hasMore,
          isLoadingMore: false,
        });
      },
      (error) => {
        console.error("❌ real-time listener error:", error);
        setState({
          posts: [],
          isLoading: false,
          isSuccess: false,
          isError: true,
          error,
          hasMore: false,
          isLoadingMore: false,
        });
      },
    );

    return () => {
      console.log("🔌 cleaning up real-time listener on log_posts collection");
      previousCommentTimestamps.current.clear();
      unsubscribe();
    };
  }, [groupId, isArchived, postLimit]);

  const loadMore = useCallback(() => {
    // Guard against stacking expansions or paging an archived (fully-loaded) group.
    // Flip the ref synchronously so a second call in the same tick is a no-op before
    // the isLoadingMore state has had a chance to flush.
    if (!hasMoreRef.current || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setState((prev) => ({ ...prev, isLoadingMore: true }));
    setPostLimit((current) => current + ACTIVE_POST_PAGE_SIZE);
  }, []);

  return { ...state, loadMore };
};
