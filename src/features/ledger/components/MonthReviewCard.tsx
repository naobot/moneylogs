import { useCurrentUser } from "@/contexts";
import Button from "@/components/Button";
import { saveMonthReview, useMonthReview } from "@/hooks/useMonthReview";
import { Ledger } from "@/types/ledger";
import { monthKeyOf } from "@/utils/ledger";
import { hasAnyBudget } from "@/utils/ledgerCategories";
import { track } from "@/utils/analytics";
import { monthName, reviewedMonth } from "@/features/ledger/buddy/monthReview";

type MonthReviewCardProps = {
  ledger: Pick<Ledger, "id" | "categories" | "monthlyBudget">;
  /** The month the stats view shows. */
  month: string;
  today: string;
  onEditBudget: () => void;
};

/**
 * The second half of the buddy's month-start review: shown above last month's stats
 * once "let's look" was picked, asking whether to change the budgets for the new month.
 * Either answer ends the review. Budgets are standing amounts, so a change now applies
 * from this month on; last month keeps its own (see utils/budgetHistory).
 */
export const MonthReviewCard = ({ ledger, month, today, onEditBudget }: MonthReviewCardProps) => {
  const { user } = useCurrentUser();
  const active = reviewedMonth(today) === month;
  const { state } = useMonthReview(user?.id, ledger.id, active ? month : null);
  if (!active || !user?.id || state?.status !== "reviewing") return null;

  const hasBudgets = hasAnyBudget(ledger.categories ?? [], ledger.monthlyBudget);
  const thisMonth = monthName(monthKeyOf(today));

  const answer = (action: "adjust" | "keep") => {
    track("month_review", { action });
    // A failed save only means the card stays (reported in saveMonthReview).
    saveMonthReview(user.id, ledger.id, month, { status: "done" }).catch(() => undefined);
    if (action === "adjust") onEditBudget();
  };

  return (
    <section className="MonthReview" aria-label={`${monthName(month)} in review`}>
      <h4 className="MonthReview__header">{monthName(month)} in review</h4>
      <p className="MonthReview__text keep-case">
        {hasBudgets
          ? `here's how ${monthName(month)} went. want to change the budgets for ${thisMonth}?`
          : `here's how ${monthName(month)} went. want to set a budget for ${thisMonth}?`}
      </p>
      <div className="MonthReview__actions">
        <Button
          text={hasBudgets ? "adjust budgets" : "set a budget"}
          size="sm"
          onClick={() => answer("adjust")}
        />
        <Button
          text={hasBudgets ? "keep them" : "not now"}
          size="sm"
          variant="secondary"
          onClick={() => answer("keep")}
        />
      </div>
    </section>
  );
};

export default MonthReviewCard;
