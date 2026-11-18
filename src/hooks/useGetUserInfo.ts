import { useState, useEffect, useRef } from "react";
import {
  collection,
  where,
  query,
  onSnapshot,
  Timestamp,
  waitForPendingWrites,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { ArchivedLogsMap } from "@/utils/archivedLogs";
import type { EmailPrefs, NotificationPrefs } from "@/types/notification";
import { LogLastViewedAtMap } from "@/utils/logActivity";
import type { Currency } from "@/types/user";
import { reportError } from "@/utils/reportError";
import { storage } from "@/platform";

export type MoneyLog = {
  id: number;
};

export type UserTutorials = {
  /** Per financial log: when its tooltip tour was finished or skipped. */
  ledgerTours?: Record<string, Timestamp>;
  /** Legacy: the one personal-log tour before it went per-log. No longer read. */
  ledgerTour?: Timestamp;
  /** When the Home nudge pointing at the personal ledger was dismissed or followed. */
  ledgerNudge?: Timestamp;
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
  /** The place picked for the timezone ("Kyoto, Japan"). Private: not mirrored to profiles. */
  timezonePlace?: string;
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
  } /** Logs this user has archived for themselves (see utils/archivedLogs). */;
  archivedLogs?: ArchivedLogsMap;
  /** When this user last opened each log (see utils/logActivity). */
  logLastViewedAt?: LogLastViewedAtMap;
  /** Per-type notification switches; unset keys use the defaults in utils/notificationTypes. */
  notificationPrefs?: NotificationPrefs;
  /** Per-type daily email digest switches; unset keys use EMAIL_PREF_DEFAULTS. */
  emailPrefs?: EmailPrefs;
  /** Switches all email off (the "unsubscribe from all" link sets it too). */
  emailPaused?: boolean;
  /** Show my friends list on my profile (opt-in; see functions/src/friendList.ts). */
  showFriends?: boolean;
  /** Leave me off other people's public friends lists (opt-out). */
  hideFromFriendLists?: boolean;
  /** Id of the solo "personal" ledger made for this user (see utils/personalLedger). */
  personalLedgerId?: string;
  /** The currency the user chose as theirs (see utils/currency for how it's applied). */
  defaultCurrency?: Currency;
  /** Set at registration until the welcome wizard is finished (see features/onboarding). */
  onboardingPending?: boolean;
  /** One-time guided tours and nudges this user has already seen. */
  tutorials?: UserTutorials;
  /** Self-drawn 30×30 pixel avatar ("#"/"." rows), mirrored to profiles/{id}. */
  avatar?: string[] | null;
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
  /** The place picked for the timezone ("Kyoto, Japan"). Private: not mirrored to profiles. */
  timezonePlace?: string;
  pinnedPosts?: {
    [logGroupId: string]: {
      [pinnedPost: string]: string;
    };
  };
  archivedLogs?: ArchivedLogsMap;
  logLastViewedAt?: LogLastViewedAtMap;
  personalLedgerId?: string;
  defaultCurrency?: Currency;
  onboardingPending?: boolean;
  tutorials?: UserTutorials;
  avatar?: string[] | null;
}

const CACHE_DURATION = 60 * 60 * 1000;
const getCacheKey = (userId: string) => `currentUser_${userId}`;

export const getCachedUser = (userId: string): CacheableUserData | null => {
  try {
    const cached = storage.get(getCacheKey(userId));
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached) as {
      data: CacheableUserData;
      timestamp: number;
    };
    const isExpired = Date.now() - timestamp > CACHE_DURATION;

    if (isExpired) {
      storage.remove(getCacheKey(userId));
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
    storage.set(getCacheKey(userId), JSON.stringify(cacheData));
    console.log("💾 Cached current user profile");
  } catch (error) {
    console.warn("Failed to cache user:", error);
  }
};

export const useGetUserInfo = (userId: string) => {
  const [user, setUser] = useState<UserData | undefined>(undefined);
  // The userId the current answer (cache, snapshot or error) is for. Loading is derived
  // from it, so a new userId reads as loading from its first render, not "no user".
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const isLoading = !!userId && resolvedFor !== userId;
  const [error, setError] = useState<unknown>(null);
  // The user doc id the server has confirmed. See isUserDocSaved below.
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId) {
      setUser(undefined);
      return;
    }

    const cachedUser = getCachedUser(userId);
    // Never carry a previous account's user over to this one.
    setUser(cachedUser ? (cachedUser as unknown as UserData) : undefined);
    if (cachedUser) setResolvedFor(userId);

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
          setResolvedFor(userId);
          setError(null);

          // Registration's addDoc shows up here before the server has it. Wait for it
          // to land; once a doc is saved it stays saved, whatever later edits are pending.
          if (!userDoc.metadata.hasPendingWrites) {
            setSavedDocId(userDoc.id);
          } else {
            waitForPendingWrites(db).then(
              () => setSavedDocId(userDoc.id),
              () => {
                // Signed out or the app closed first; the next snapshot tries again.
              },
            );
          }

          const cacheableData: CacheableUserData = {
            id: userData.id,
            createdAt: userData.createdAt,
            displayName: userData.displayName,
            displayLocation: userData.displayLocation,
            email: userData.email,
            userId: userData.userId,
            currentLogId: userData.currentLogId,
            timezone: userData.timezone,
            timezonePlace: userData.timezonePlace,
            pinnedPosts: userData.pinnedPosts,
            archivedLogs: userData.archivedLogs,
            // So Home can count new activity before the live listener lands.
            logLastViewedAt: userData.logLastViewedAt,
            personalLedgerId: userData.personalLedgerId,
            // So the welcome gate and the currency prompt don't misfire before the listener lands.
            defaultCurrency: userData.defaultCurrency,
            onboardingPending: userData.onboardingPending,
            tutorials: userData.tutorials,
            avatar: userData.avatar,
          };

          setCachedUser(userId, cacheableData);
        } else {
          setUser(undefined);
          setResolvedFor(userId);
          setError(new Error("User not found"));
        }
      },
      (err) => {
        setError(err);
        setResolvedFor(userId);
        reportError(err, { feature: "account", action: "listen_current_user" });
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
    /**
     * Whether the user doc exists on the server, not just in this tab's pending writes.
     * Rules that check ownership read it there (ownsUserDoc), so queries of the user's
     * subcollections must wait for this, or a brand-new account's first query is denied.
     */
    isUserDocSaved: !!user && savedDocId === user.id,
    isLoading,
    isSuccess: !!user && !error,
    isError: !!error,
    error,
    currentLogId: user?.currentLogId,
  };
};
