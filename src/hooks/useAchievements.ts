import { useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { Currency, LogPost } from "@/types/user";

export type AchievementType = "top_spender" | "lowest_spender";

export type Achievement = {
  id: string;
  type: AchievementType;
  groupId: string;
  groupTitle: string;
  currency: Currency;
  unlockedAt: { seconds: number; toDate: () => Date };
};

export const ACHIEVEMENT_META: Record<
  AchievementType,
  { emoji: string; title: string; description: (currency: string) => string }
> = {
  top_spender: {
    emoji: "🏆",
    title: "Top Spender",
    description: (currency) => `Highest total ${currency} spending in the group`,
  },
  lowest_spender: {
    emoji: "💡",
    title: "Lowest Spender",
    description: (currency) => `Lowest total ${currency} spending in the group`,
  },
};

const achievementsCollection = (userId: string) => collection(db, "users", userId, "achievements");

const achievementDocId = (groupId: string, type: AchievementType, currency: string) =>
  `${groupId}__${type}__${currency}`;

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

  if (eligibleCurrencies.length === 0) return [];

  // Fetch existing achievements to avoid duplicate writes
  const existingSnapshot = await getDocs(achievementsCollection(userId));
  const existingIds = new Set(existingSnapshot.docs.map((d) => d.id));

  const newlyUnlocked: Achievement[] = [];

  for (const currency of eligibleCurrencies) {
    const ranked = [...totalsByUserCurrency.entries()]
      .filter(([, m]) => m.has(currency))
      .map(([uid, m]) => ({ uid, total: m.get(currency)! }))
      .sort((a, b) => b.total - a.total); // highest first

    const toCheck: { type: AchievementType; qualifies: boolean }[] = [
      { type: "top_spender", qualifies: ranked[0].uid === userId },
      { type: "lowest_spender", qualifies: ranked[ranked.length - 1].uid === userId },
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

  return newlyUnlocked;
};
