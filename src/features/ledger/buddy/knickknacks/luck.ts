import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";

/**
 * Luck: how likely the budget buddy is to find something. The server works it out from
 * spending habits across your financial logs and how often you drop by
 * (functions/src/luck.ts), and only ever shares it in words.
 */
export const LUCK_TIERS = [
  "not_so_lucky",
  "a_little_lucky",
  "average",
  "pretty_lucky",
  "super_lucky",
] as const;
export type LuckTier = (typeof LUCK_TIERS)[number];

export const LUCK_WORDS: Record<LuckTier, string> = {
  not_so_lucky: "not so lucky",
  a_little_lucky: "a little lucky",
  average: "average luck",
  pretty_lucky: "pretty lucky",
  super_lucky: "super lucky!",
};

export const isLuckTier = (value: unknown): value is LuckTier =>
  (LUCK_TIERS as readonly unknown[]).includes(value);

/**
 * Your luck, live, from users/{userDocId}/luck/current. Null until the server has worked
 * it out (on your first check-in), or when it's a tier this build doesn't know.
 */
export const useLuck = (userDocId?: string): LuckTier | null => {
  // Keyed to the user it was read for, so switching accounts never shows the last one's.
  const [read, setRead] = useState<{ userDocId: string; tier: LuckTier | null } | null>(null);

  useEffect(() => {
    if (!userDocId) return;
    return onSnapshot(
      doc(db, "users", userDocId, "luck", "current"),
      (snap) => {
        const value = snap.get("tier");
        setRead({ userDocId, tier: isLuckTier(value) ? value : null });
      },
      (error) =>
        reportError(error, { feature: "budget_buddy", action: "read_luck", level: "warning" }),
    );
  }, [userDocId]);

  return read && read.userDocId === userDocId ? read.tier : null;
};
