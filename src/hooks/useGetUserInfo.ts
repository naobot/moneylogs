import { useState, useEffect, useRef } from "react";
import { collection, where, query, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase-config";

export type MoneyLog = {
  id: number;
};

export type UserData = {
  id: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  displayName: string;
  displayLocation?: string;
  email: string;
  groups: Array<string>;
  userId: string;
  currentLogId: string;
  timezone?: string;
  pinnedPosts?: {
    [logGroupId: string]: {
      [pinnedPost: string]: string;
    };
  };
  commentSubscriptions?: {
    [logPostId: string]: {
      [lastViewedAt: string]: Timestamp;
    };
  };
  hasUnreadComments?: {
    [groupId: string]: boolean;
  };
  viewTracking?: {
    [key: string]: {
      [key: string]: {
        lastViewedAt: Timestamp;
      };
    };
  };
};

export interface CacheableUserData {
  id: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  displayName: string;
  displayLocation?: string;
  email: string;
  userId: string;
  currentLogId: string;
  timezone?: string;
  pinnedPosts?: {
    [logGroupId: string]: {
      [pinnedPost: string]: string;
    };
  };
}

const CACHE_DURATION = 60 * 60 * 1000;
const getCacheKey = (userId: string) => `currentUser_${userId}`;

export const getCachedUser = (userId: string): CacheableUserData | null => {
  try {
    const cached = localStorage.getItem(getCacheKey(userId));
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached) as {
      data: CacheableUserData;
      timestamp: number;
    };
    const isExpired = Date.now() - timestamp > CACHE_DURATION;

    if (isExpired) {
      localStorage.removeItem(getCacheKey(userId));
      return null;
    }

    console.log("📱 Using cached current user profile");
    return data;
  } catch {
    return null;
  }
};

export const setCachedUser = (userId: string, user: CacheableUserData) => {
  try {
    const cacheData = {
      data: user,
      timestamp: Date.now(),
    };
    localStorage.setItem(getCacheKey(userId), JSON.stringify(cacheData));
    console.log("💾 Cached current user profile");
  } catch (error) {
    console.warn("Failed to cache user:", error);
  }
};

export const useGetUserInfo = (userId: string) => {
  const [user, setUser] = useState<UserData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId) {
      setUser(undefined);
      setIsLoading(false);
      return;
    }

    const cachedUser = getCachedUser(userId);
    if (cachedUser) {
      setUser(cachedUser as unknown as UserData);
      setIsLoading(false);
    }

    console.log("🔄 setting up real-time listener for current user");

    const userQuery = query(collection(db, "users"), where("userId", "==", userId));

    const unsubscribe = onSnapshot(
      userQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          const userData = {
            id: userDoc.id,
            ...userDoc.data(),
          } as UserData;

          console.log("📡 received current user data from real-time listener");

          setUser(userData);
          setIsLoading(false);
          setError(null);

          const cacheableData: CacheableUserData = {
            id: userData.id,
            createdAt: userData.createdAt,
            displayName: userData.displayName,
            displayLocation: userData.displayLocation,
            email: userData.email,
            userId: userData.userId,
            currentLogId: userData.currentLogId,
            timezone: userData.timezone,
            pinnedPosts: userData.pinnedPosts,
          };

          setCachedUser(userId, cacheableData);
        } else {
          setUser(undefined);
          setIsLoading(false);
          setError(new Error("User not found"));
        }
      },
      (err) => {
        setError(err);
        setIsLoading(false);
        console.error("❌ Error in current user real-time listener:", err);
      },
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        console.log("🔌 cleaning up current user real-time listener");
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId]);

  return {
    user,
    isLoading,
    isSuccess: !!user && !error,
    isError: !!error,
    error,
    currentLogId: user?.currentLogId,
  };
};
