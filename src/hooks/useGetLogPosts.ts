import { useEffect, useState, useRef } from "react";
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

const ACTIVE_GROUP_POST_LIMIT = 200;

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
};

const initialState: LogPostsState = {
  posts: [],
  isLoading: false,
  isSuccess: false,
  isError: false,
  error: undefined,
};

export const useGetLogPosts = ({ groupId, isArchived = false }: UseGetLogPostsParams) => {
  const [state, setState] = useState<LogPostsState>(initialState);
  const previousCommentTimestamps = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    if (!groupId || typeof groupId !== "string") {
      setState(initialState);
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const groupDocRef = doc(db, "log_groups", groupId);

    if (isArchived) {
      // Archived groups: one-time read, no listener. Data is immutable once archived
      // so a live WebSocket connection serves no purpose.
      let cancelled = false;

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
          setState({ posts, isLoading: false, isSuccess: true, isError: false, error: undefined });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error("❌ error fetching archived log posts:", error);
          setState({ posts: [], isLoading: false, isSuccess: false, isError: true, error });
        });

      return () => {
        cancelled = true;
      };
    }

    // Active groups: real-time listener capped at ACTIVE_GROUP_POST_LIMIT.
    // The cap prevents unbounded reads for long-running sessions while preserving
    // real-time updates and comment notification tracking for all visible posts.
    const postsQuery = query(
      collection(db, "log_posts"),
      where("group", "==", groupDocRef),
      orderBy("postDate", "desc"),
      limit(ACTIVE_GROUP_POST_LIMIT),
    );

    console.log("🔄 setting up real-time listener on log_posts collection");

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

        setState({ posts, isLoading: false, isSuccess: true, isError: false, error: undefined });
      },
      (error) => {
        console.error("❌ real-time listener error:", error);
        setState({ posts: [], isLoading: false, isSuccess: false, isError: true, error });
      },
    );

    return () => {
      console.log("🔌 cleaning up real-time listener on log_posts collection");
      previousCommentTimestamps.current.clear();
      unsubscribe();
    };
  }, [groupId, isArchived]);

  return state;
};
