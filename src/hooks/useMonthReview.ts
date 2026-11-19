import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import {
  MonthReviewState,
  MonthReviewStatus,
  reviewDocId,
} from "@/features/ledger/buddy/monthReview";
import { reportError } from "@/utils/reportError";

const reviewRef = (userDocId: string, ledgerId: string, month: string) =>
  doc(db, "users", userDocId, "monthReviews", reviewDocId(ledgerId, month));

/**
 * This person's answer to the buddy's month-start review of one log's month, live. Only
 * listens while `month` is set (the review window), so it costs nothing the rest of the
 * month.
 */
export const useMonthReview = (userDocId?: string, ledgerId?: string, month?: string | null) => {
  const key = userDocId && ledgerId && month ? `${userDocId}/${ledgerId}/${month}` : null;
  const [result, setResult] = useState<{ key: string; state: MonthReviewState | null } | null>(
    null,
  );

  useEffect(() => {
    if (!userDocId || !ledgerId || !month) return;
    const k = `${userDocId}/${ledgerId}/${month}`;
    return onSnapshot(
      reviewRef(userDocId, ledgerId, month),
      (snap) => {
        const data = snap.data();
        setResult({
          key: k,
          state: data
            ? {
                status: data.status as MonthReviewStatus,
                ...(typeof data.snoozedUntil === "string" && { snoozedUntil: data.snoozedUntil }),
              }
            : null,
        });
      },
      (error) => {
        // Unnoticed: the buddy just doesn't ask.
        reportError(error, {
          feature: "budget_buddy",
          action: "load_month_review",
          level: "warning",
        });
      },
    );
  }, [userDocId, ledgerId, month]);

  const isLoaded = !!key && result?.key === key;
  return { state: isLoaded ? result.state : null, isLoaded };
};

/** Record an answer to the month-start review. */
export const saveMonthReview = (
  userDocId: string,
  ledgerId: string,
  month: string,
  next: MonthReviewState,
): Promise<void> =>
  setDoc(reviewRef(userDocId, ledgerId, month), {
    status: next.status,
    snoozedUntil: next.snoozedUntil ?? null,
    updatedAt: serverTimestamp(),
  }).catch((error: unknown) => {
    reportError(error, { feature: "budget_buddy", action: "save_month_review" });
    throw error;
  });
