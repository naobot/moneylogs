import { collection, where, query, doc, getDocs, limit } from "firebase/firestore";
import { Group } from "@/types/user";
import { absoluteStart, absoluteEnd } from "@/utils/groupBoundaries";
import { useFirebaseCollection } from "./useFirebase";
import { useEffect, useState } from "react";
import { auth, db } from "@/config/firebase-config";
import { useAuthState } from "react-firebase-hooks/auth";

export type GroupsResponse = {
  currentGroups: Array<Group>;
  allGroups: Array<Group>;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: unknown;
};

// Cache utilities
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (groups change very infrequently)
const USER_DOC_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for user doc ID mapping

const getCacheKey = (userId: string) => `currentGroups_${userId}`;
const getUserDocCacheKey = (userId: string) => `userDocId_${userId}`;

const getCachedGroups = (userId: string): Group[] | null => {
  try {
    const cached = localStorage.getItem(getCacheKey(userId));
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_DURATION;

    if (isExpired) {
      localStorage.removeItem(getCacheKey(userId));
      return null;
    }

    console.log("📱 Using cached current groups");
    return data;
  } catch {
    return null;
  }
};

const setCachedGroups = (userId: string, groups: Group[]) => {
  try {
    const cacheData = {
      data: groups,
      timestamp: Date.now(),
    };
    localStorage.setItem(getCacheKey(userId), JSON.stringify(cacheData));
    console.log("💾 Cached current groups");
  } catch (error) {
    console.warn("Failed to cache groups:", error);
  }
};

const getCachedUserDocId = (userId: string): string | null => {
  try {
    const cached = localStorage.getItem(getUserDocCacheKey(userId));
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > USER_DOC_CACHE_DURATION;

    if (isExpired) {
      localStorage.removeItem(getUserDocCacheKey(userId));
      return null;
    }

    console.log("📱 Using cached user doc ID");
    return data;
  } catch {
    return null;
  }
};

const setCachedUserDocId = (userId: string, docId: string) => {
  try {
    const cacheData = {
      data: docId,
      timestamp: Date.now(),
    };
    localStorage.setItem(getUserDocCacheKey(userId), JSON.stringify(cacheData));
    console.log("💾 Cached user doc ID");
  } catch (error) {
    console.warn("Failed to cache user doc ID:", error);
  }
};

const fetchUserDocIdFromFirestore = async (
  currentUserId: string,
  setUserDocId: (id: string | null) => void,
  setUserIdFetchError: (err: unknown) => void,
) => {
  const cachedDocId = getCachedUserDocId(currentUserId);
  if (cachedDocId) {
    setUserDocId(cachedDocId);
    setUserIdFetchError(null);
    return;
  }

  try {
    const usersQuery = query(
      collection(db, "users"),
      where("userId", "==", currentUserId),
      limit(1),
    );
    console.log("⬇️ executing read on users collection");
    const snapshot = await getDocs(usersQuery);

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      setUserDocId(docId);
      setUserIdFetchError(null);
      setCachedUserDocId(currentUserId, docId);
    } else {
      setUserDocId(null);
      setUserIdFetchError(new Error("User document not found"));
    }
  } catch (error) {
    setUserDocId(null);
    setUserIdFetchError(error);
  }
};

const buildGroupsQuery = (userDocId: string) =>
  query(
    collection(db, "log_groups"),
    where("members", "array-contains", doc(db, "users", userDocId)),
  );

export const useGetCurrentGroups = (): GroupsResponse => {
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [userIdFetchError, setUserIdFetchError] = useState<unknown>(null);
  const [cachedGroups, setCachedGroupsState] = useState<Group[] | null>(null);

  const [firebaseUser, firebaseLoading] = useAuthState(auth);
  const currentUserId = firebaseUser?.uid || null;

  // Check for cached groups immediately
  useEffect(() => {
    if (currentUserId) {
      const cached = getCachedGroups(currentUserId);
      if (cached) {
        setCachedGroupsState(cached);
      }
    }
  }, [currentUserId]);

  // Fetch the user's document ID from their userId (with caching)
  useEffect(() => {
    if (!currentUserId) {
      setUserDocId(null);
      return;
    }
    void fetchUserDocIdFromFirestore(currentUserId, setUserDocId, setUserIdFetchError);
  }, [currentUserId]);

  const { data, isLoading, isSuccess, isError, error } = useFirebaseCollection<Group>({
    queryBuilder: () => {
      if (!userDocId) return null;
      console.log("⬇️ executing read on log_groups collection");
      return buildGroupsQuery(userDocId);
    },
    dataTransformer: (docs) => {
      const groups = docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Group[];

      // Cache the fresh groups data
      if (currentUserId && groups.length > 0) {
        setCachedGroups(currentUserId, groups);
      }

      return groups;
    },
    dependencies: [userDocId],
    enabled: !!userDocId,
  });

  // Combine loading states and errors
  const combinedIsLoading =
    firebaseLoading || isLoading || (!userDocId && !userIdFetchError && !!currentUserId);
  const combinedIsError = isError || !!userIdFetchError;
  const combinedError = error || userIdFetchError;

  // Use cached data for instant display while fresh data loads
  const allGroups = data || cachedGroups || [];

  return {
    currentGroups: allGroups.filter((group) => {
      const now = new Date();
      return absoluteStart(group).toDate() <= now && absoluteEnd(group).toDate() >= now;
    }),
    allGroups,
    isLoading: combinedIsLoading,
    isSuccess:
      (!combinedIsLoading && isSuccess && !!userDocId) ||
      (!!cachedGroups && cachedGroups.length > 0),
    isError: combinedIsError,
    error: combinedError,
  };
};
