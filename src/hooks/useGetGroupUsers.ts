import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, doc, DocumentSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase-config";

// type UseGetGroupUsersParams = {
//   userIds: string[] // Array of user document IDs
// }

export interface CacheableUserData {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  groups: string[];
  timezone?: string;
  pinnedPosts?: {
    [logGroupId: string]: {
      [pinnedPost: string]: string;
    };
  };
}

interface RealtimeUserData {
  viewTracking: Record<string, unknown>;
  commentSubscriptions: Record<string, unknown>;
  lastSeen?: Date;
}

export interface FullUserData extends CacheableUserData, RealtimeUserData {}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const getCacheKey = (groupId: string) => `groupUsers_${groupId}`;

export const getCachedUsers = (groupId: string): CacheableUserData[] | null => {
  try {
    const cached = localStorage.getItem(getCacheKey(groupId));
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_DURATION;

    if (isExpired) {
      localStorage.removeItem(getCacheKey(groupId));
      return null;
    }

    console.log(`📱 Using cached user profiles for group ${groupId}`, data);
    return data;
  } catch {
    return null;
  }
};

export const setCachedUsers = (groupId: string, users: CacheableUserData[]) => {
  try {
    const cacheData = {
      data: users,
      timestamp: Date.now(),
    };
    localStorage.setItem(getCacheKey(groupId), JSON.stringify(cacheData));
    console.log(`💾 Cached user profiles for group ${groupId}`);
  } catch (error) {
    console.warn("Failed to cache users:", error);
  }
};

export const useGetGroupUsers = (groupId: string) => {
  const [users, setUsers] = useState<FullUserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user ID to doc ref mapping (for your view tracking)
  const userIdToDocRefMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      map.set(user.userId || user.id, user.id); // Adjust based on your user object structure
    });
    return map;
  }, [users]);

  useEffect(() => {
    // console.log(`getGroupUsers for ${groupId}`)

    if (!groupId) return;

    // Try to get cached user profiles first
    const cachedUsers = getCachedUsers(groupId);

    // console.log(`Found cached users for ${groupId}`, cachedUsers)

    if (cachedUsers) {
      // Use cached data immediately for instant display
      // (Real-time listener will update with fresh data)
      setUsers(cachedUsers as FullUserData[]);
      setIsLoading(false);
    }

    // Listen to the group document live (rather than reading it once) so the member
    // set stays current: a stale or partial initial read — or a membership change —
    // self-corrects within this mount instead of only after a remount (which is why
    // a missing own-log used to reappear only after navigating away and back).
    console.log("🔄 setting up real-time listeners for users");

    let memberUnsubs: (() => void)[] = [];
    let currentMemberKey: string | null = null;

    const teardownMemberListeners = () => {
      memberUnsubs.forEach((fn) => fn());
      memberUnsubs = [];
    };

    const groupUnsub = onSnapshot(
      doc(db, "log_groups", groupId),
      (groupDoc) => {
        const memberRefs = groupDoc.data()?.members || [];

        // Only rebuild the member listeners when the set of members actually
        // changes, so unrelated group-doc updates don't churn subscriptions.
        const memberKey = memberRefs
          .map((ref: { id?: string; path?: string }) => ref?.id ?? ref?.path ?? "")
          .join("|");
        if (memberKey === currentMemberKey) return;
        currentMemberKey = memberKey;

        teardownMemberListeners();

        // Chunk members into groups of 10 (Firestore 'in' query limit)
        const chunks = chunkArray(memberRefs, 10);

        if (chunks.length === 0) {
          setUsers([]);
          setIsLoading(false);
          return;
        }

        // Hold each chunk's latest results in its own slot. Merging by flattening
        // these slots is independent of snapshot arrival order and of how many docs
        // each chunk actually returns — unlike a shared array spliced by index,
        // which drops members when a later chunk's snapshot lands before an earlier
        // one's (and can poison the cache with a partial list).
        const chunkResults: FullUserData[][] = chunks.map(() => []);
        const receivedChunks = new Set<number>();

        chunks.forEach((chunk, chunkIndex) => {
          const chunkQuery = query(collection(db, "users"), where("__name__", "in", chunk));

          const unsubscribe = onSnapshot(chunkQuery, (snapshot) => {
            const chunkUsers: FullUserData[] = [];

            snapshot.forEach((doc: DocumentSnapshot) => {
              const userData = doc.data();
              if (userData) {
                chunkUsers.push({
                  id: doc.id,
                  ...userData,
                } as FullUserData);
              }
            });

            console.log(`📡 received ${chunkUsers.length} users from query ${chunkIndex + 1}`);

            chunkResults[chunkIndex] = chunkUsers;
            receivedChunks.add(chunkIndex);

            const allUsers = chunkResults.flat();

            // Update state with current users
            setUsers(allUsers);
            setIsLoading(false);

            // Only cache once every chunk has reported at least once, so we never
            // persist a partial member list.
            if (receivedChunks.size === chunks.length) {
              const cacheableData: CacheableUserData[] = allUsers.map((user) => ({
                id: user.id,
                userId: user.userId,
                displayName: user.displayName,
                email: user.email,
                timezone: user.timezone,
                groups: user.groups,
                // Only include stable fields, exclude viewTracking, etc.
              }));

              // Update cache with fresh stable data
              setCachedUsers(groupId, cacheableData);
            }
          });

          memberUnsubs.push(unsubscribe);
        });
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to fetch users");
        setIsLoading(false);
      },
    );

    return () => {
      console.log("🔌 cleaning up real-time listeners on users + group");
      groupUnsub();
      teardownMemberListeners();
    };
  }, [groupId]);

  return {
    users,
    userIdToDocRefMap,
    isLoading,
    error,
  };
};

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};
