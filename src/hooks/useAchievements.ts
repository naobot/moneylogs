import { useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { Currency, Group, LogPost } from "@/types/user";
import { absoluteEnd } from "@/utils/groupBoundaries";
import { IconType } from "@/components/Icon";

export type AchievementType = "top_spender" | "lowest_spender" | "time_traveller";

export type Achievement = {
  id: string;
  type: AchievementType;
  groupId: string;
  groupTitle: string;
  currency?: Currency; // undefined for non-currency achievements (e.g. time_traveller)
  unlockedAt: { seconds: number; toDate: () => Date };
};

export const ACHIEVEMENT_META: Record<
  AchievementType,
  { icon: IconType; title: string; description: (currency?: string) => string }
> = {
  top_spender: {
    icon: "dollar",
    title: "Top Spender",
    description: (currency) => `Highest total ${currency} spending in the group`,
  },
  lowest_spender: {
    icon: "dollar",
    title: "Lowest Spender",
    description: (currency) => `Lowest total ${currency} spending in the group`,
  },
  time_traveller: {
    icon: "location",
    title: "Time Traveller",
    description: () => "Logged entries from multiple timezones in one session",
  },
};

const achievementsCollection = (userId: string) => collection(db, "users", userId, "achievements");

const achievementDocId = (groupId: string, type: AchievementType, currency?: string) =>
  currency ? `${groupId}__${type}__${currency}` : `${groupId}__${type}`;

/**
 * Every achievement a user holds for one group: what is already stored, plus anything
 * just unlocked, deduped by doc id and stably ordered.
 *
 * Neither source is complete on its own — awardGroupAchievements returns only the docs
 * it just wrote (deterministic ids mean repeat visits return nothing), while the stored
 * fetch can resolve before that write lands.
 */
export const mergeGroupAchievements = (
  held: Achievement[],
  newlyUnlocked: Achievement[],
  groupId: string,
): Achievement[] => {
  const byId = new Map<string, Achievement>();
  [...held, ...newlyUnlocked]
    .filter((achievement) => achievement.groupId === groupId)
    .forEach((achievement) => byId.set(achievement.id, achievement));

  // Firestore returns the subcollection unordered, so impose one.
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
};

/**
 * Order achievements to match the Past groups list — by when their group ended,
 * most recent first.
 *
 * Deliberately not keyed on unlockedAt: that records when the user first opened the
 * completed group's summary, which can be long after the group itself ended, so a
 * recently-viewed old group would otherwise jump above a newer one.
 *
 * Achievements whose group isn't in `groups` fall back to unlockedAt so they still
 * land somewhere deterministic, and ties (several achievements from one group) break
 * on doc id to keep the order stable between renders.
 */
export const sortAchievementsByGroupEnd = (
  achievements: Achievement[],
  groups: Group[],
): Achievement[] => {
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  const endedAt = (achievement: Achievement): number => {
    const group = groupsById.get(achievement.groupId);
    if (group) return absoluteEnd(group).valueOf();
    return (achievement.unlockedAt?.seconds ?? 0) * 1000;
  };

  return [...achievements].sort((a, b) => {
    const diff = endedAt(b) - endedAt(a);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
};

export const useGetAchievements = (userId?: string) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    getDocs(achievementsCollection(userId))
      .then((snapshot) => {
        if (cancelled) return;
        setAchievements(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Achievement));
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { achievements, isLoading };
};

// Checks eligibility and writes any newly earned achievements for a completed group.
// Returns the achievements that were just unlocked (empty if already held or ineligible).
// Safe to call multiple times — uses deterministic doc IDs so repeat calls are no-ops.
export const awardGroupAchievements = async ({
  userId,
  groupId,
  groupTitle,
  logPosts,
}: {
  userId: string;
  groupId: string;
  groupTitle: string;
  logPosts: LogPost[];
}): Promise<Achievement[]> => {
  if (logPosts.length === 0) return [];

  // Build per-user totals by currency (only users who have posted in that currency)
  const totalsByUserCurrency = new Map<string, Map<Currency, number>>();
  logPosts.forEach((post) => {
    const authorId = post.author.id;
    if (!totalsByUserCurrency.has(authorId)) {
      totalsByUserCurrency.set(authorId, new Map());
    }
    const curr = totalsByUserCurrency.get(authorId)!;
    curr.set(post.currency, (curr.get(post.currency) ?? 0) + post.amount);
  });

  // Find currencies where 3+ distinct users have posted
  const allCurrencies = new Set<Currency>(logPosts.map((p) => p.currency));
  const eligibleCurrencies = [...allCurrencies].filter((currency) => {
    const participantCount = [...totalsByUserCurrency.values()].filter((m) =>
      m.has(currency),
    ).length;
    return participantCount >= 3;
  });

  // Time Traveller: current user posted from 2+ distinct timezones
  const userPosts = logPosts.filter((post) => post.author.id === userId);
  const userTimezones = new Set(userPosts.filter((p) => p.timezone).map((p) => p.timezone!));
  const isTimeTraveller = userTimezones.size >= 2;

  if (eligibleCurrencies.length === 0 && !isTimeTraveller) return [];

  // Fetch existing achievements to avoid duplicate writes
  const existingSnapshot = await getDocs(achievementsCollection(userId));
  const existingIds = new Set(existingSnapshot.docs.map((d) => d.id));

  const newlyUnlocked: Achievement[] = [];

  // Currency-based achievements (Top / Lowest Spender)
  for (const currency of eligibleCurrencies) {
    const ranked = [...totalsByUserCurrency.entries()]
      .filter(([, m]) => m.has(currency))
      .map(([uid, m]) => ({ uid, total: m.get(currency)! }))
      .sort((a, b) => b.total - a.total); // highest first

    // A shared extreme is not a distinction: when the highest (or lowest) total is
    // tied, nobody takes it rather than it falling to whoever happened to sort first.
    // ranked.length >= 3 here, so the neighbour indices always exist.
    const last = ranked.length - 1;
    // Totals are sums of decimal amounts, so compare with a tolerance — 300.1 + 200.2
    // and 500.3 are the same spend but not === equal in floating point.
    const isTied = (a: number, b: number) => Math.abs(a - b) < 1e-9;

    const toCheck: { type: AchievementType; qualifies: boolean }[] = [
      {
        type: "top_spender",
        qualifies: ranked[0].uid === userId && !isTied(ranked[0].total, ranked[1].total),
      },
      {
        type: "lowest_spender",
        qualifies:
          ranked[last].uid === userId && !isTied(ranked[last].total, ranked[last - 1].total),
      },
    ];

    for (const { type, qualifies } of toCheck) {
      if (!qualifies) continue;

      const docId = achievementDocId(groupId, type, currency);
      if (existingIds.has(docId)) continue;

      await setDoc(doc(db, "users", userId, "achievements", docId), {
        type,
        groupId,
        groupTitle,
        currency,
        unlockedAt: serverTimestamp(),
      });

      newlyUnlocked.push({
        id: docId,
        type,
        groupId,
        groupTitle,
        currency,
        unlockedAt: { seconds: Date.now() / 1000, toDate: () => new Date() },
      });
    }
  }

  // Time Traveller achievement (no currency)
  if (isTimeTraveller) {
    const docId = achievementDocId(groupId, "time_traveller");
    if (!existingIds.has(docId)) {
      await setDoc(doc(db, "users", userId, "achievements", docId), {
        type: "time_traveller",
        groupId,
        groupTitle,
        unlockedAt: serverTimestamp(),
      });

      newlyUnlocked.push({
        id: docId,
        type: "time_traveller",
        groupId,
        groupTitle,
        unlockedAt: { seconds: Date.now() / 1000, toDate: () => new Date() },
      });
    }
  }

  return newlyUnlocked;
};
