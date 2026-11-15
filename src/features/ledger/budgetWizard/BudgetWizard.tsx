import { ReactNode, useMemo, useState } from "react";
import cx from "classnames";

import Wizard from "@/components/Wizard/Wizard";
import RowButton from "@/components/RowButton";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { DEFAULT_CATEGORIES } from "@/utils/ledger";
import { formatAmount, parseAmount } from "@/utils/ledgerEntries";
import { CategoryOp, MAX_BUDGET } from "@/utils/ledgerCategories";
import {
  editPlan,
  EditedPlan,
  PLAN_GROUPS,
  planBudget,
  PieDatum,
  PlanGroup,
  planGroupOf,
  resetToDefaultsOps,
  SAVING_STYLES,
  SavingStyleId,
} from "./budgetPlan";
import { BudgetPie, Swatch } from "./BudgetPie";

import "./BudgetWizard.scss";

type Step = "start" | "income" | "housing" | "saving" | "plan";
const STEPS: Step[] = ["start", "income", "housing", "saving", "plan"];
const LABELS = ["Start", "Income", "Housing", "Saving", "Plan"];

export type AcceptedPlan = {
  /** Category ops that reset the log to the default categories. */
  resetOps: CategoryOp[];
  currency: Currency;
  /** Suggested monthly budget by (actual) category id. Zero means no budget. */
  amounts: Record<string, number>;
};

type BudgetWizardProps = {
  categories: ReadonlyArray<LedgerCategory>;
  /** Pre-selected currency for income. */
  defaultCurrency: Currency;
  onCancel: () => void;
  onUse: (plan: AcceptedPlan) => void;
  /** First plan's seed; re-rolls pick new ones. Fixed in tests. */
  initialSeed?: number;
};

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

/** Parses an optional amount: empty counts as zero; anything else must be a number. */
const parseOptional = (raw: string): number => (raw.trim() === "" ? 0 : parseAmount(raw));
const isValidMoney = (n: number) => Number.isFinite(n) && n >= 0 && n <= MAX_BUDGET;

const NAME_OF = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));

/**
 * The budget helper: a few questions, then a suggested monthly budget for each default
 * category that can be re-rolled and then handed to the Budgets window to adjust.
 */
export const BudgetWizard = ({
  categories,
  defaultCurrency,
  onCancel,
  onUse,
  initialSeed,
}: BudgetWizardProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [income, setIncome] = useState("");
  const [housing, setHousing] = useState("");
  const [utilities, setUtilities] = useState("");
  const [style, setStyle] = useState<SavingStyleId | null>(null);
  const [seed, setSeed] = useState(() => initialSeed ?? newSeed());
  // The user's in-place changes to the suggested amounts, by category id.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const reset = useMemo(() => resetToDefaultsOps(categories), [categories]);
  const step = STEPS[stepIndex];

  const incomeValue = parseAmount(income);
  const housingValue = parseOptional(housing);
  const utilitiesValue = parseOptional(utilities);
  const incomeValid = incomeValue > 0 && isValidMoney(incomeValue);
  const fixedValid = isValidMoney(housingValue) && isValidMoney(utilitiesValue);

  const plan =
    style && incomeValid && fixedValid
      ? planBudget({
          income: incomeValue,
          housing: housingValue,
          utilities: utilitiesValue,
          style,
          seed,
        })
      : null;

  const edited = plan?.ok ? editPlan(plan.rows, edits, incomeValue) : null;

  const canContinue: Record<Step, boolean> = {
    start: !reset.tooMany,
    income: incomeValid,
    housing: fixedValid,
    saving: style !== null,
    plan: !!edited && !edited.hasInvalid && edited.over === 0,
  };

  const next = () => {
    if (step !== "plan") {
      setStepIndex((i) => i + 1);
      return;
    }
    if (!edited) return;
    onUse({
      resetOps: reset.ops,
      currency,
      amounts: Object.fromEntries(edited.rows.map((r) => [reset.idFor[r.id] ?? r.id, r.amount])),
    });
  };

  let body: ReactNode = null;
  switch (step) {
    case "start":
      body = (
        <>
          <h3 className="Wizard__question">Need a starting point?</h3>
          <p>
            Answer a few questions about your month and we'll suggest a budget for each category.
            You can re-roll the suggestion, then adjust any amount before saving.
          </p>
          <CategoryWarning reset={reset} />
        </>
      );
      break;

    case "income":
      body = (
        <>
          <h3 className="Wizard__question">How much do you bring in each month?</h3>
          <p className="Wizard__hint">Your take-home pay, after tax.</p>
          <label className="BudgetWizard__field">
            <span>Monthly income</span>
            <span className="BudgetWizard__amount">
              <input
                className="LineInput"
                aria-label="Monthly income"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder="0"
                value={income}
                aria-invalid={income.trim() !== "" && !incomeValid}
                onChange={(e) => setIncome(e.target.value)}
              />
              <select
                aria-label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </>
      );
      break;

    case "housing":
      body = (
        <>
          <h3 className="Wizard__question">What do your home costs come to?</h3>
          <p className="Wizard__hint">Monthly amounts. Leave one empty if it doesn't apply.</p>
          <AmountField
            label="Rent or mortgage"
            value={housing}
            currency={currency}
            onChange={setHousing}
            autoFocus
          />
          <AmountField
            label="Utilities"
            hint="Power, water, gas, internet, phone"
            value={utilities}
            currency={currency}
            onChange={setUtilities}
          />
        </>
      );
      break;

    case "saving":
      body = (
        <>
          <h3 className="Wizard__question">How hard do you want to save?</h3>
          <div
            className="Wizard__choices BudgetWizard__styles"
            role="radiogroup"
            aria-label="Saving"
          >
            {SAVING_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                className={cx("Wizard__choice", { "Wizard__choice--selected": style === s.id })}
                onClick={() => setStyle(s.id)}
              >
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </>
      );
      break;

    case "plan":
      body = (
        <>
          <div className="BudgetWizard__planHeader">
            <h3 className="Wizard__question">Here's a starting point</h3>
            {plan?.ok && (
              <RowButton
                onClick={() => {
                  setSeed(newSeed());
                  setEdits({});
                }}
              >
                re-roll
              </RowButton>
            )}
          </div>
          {plan && !plan.ok ? (
            <p className="error-message">
              Housing and utilities take up all of that income, so there's nothing left to plan
              with. Go back and check the amounts.
            </p>
          ) : (
            plan?.ok &&
            edited && (
              <>
                <p className="Wizard__hint">
                  Every amount here is a suggestion you can change, and you can keep adjusting them
                  in the Budgets window too. Whatever isn't budgeted is left to save. Re-rolling
                  replaces your changes.
                </p>
                <BudgetPie data={pieData(edited, currency)} summary={pieSummary(edited)} />
                <ul className="BudgetWizard__plan" aria-label="Suggested budget">
                  {edited.rows.map((row) => (
                    <PlanRow
                      key={row.id}
                      name={NAME_OF.get(row.id) ?? row.id}
                      group={planGroupOf(row.id)}
                      pct={row.pct}
                    >
                      <span className="BudgetWizard__amount">
                        <input
                          className="LineInput"
                          aria-label={`${NAME_OF.get(row.id) ?? row.id} budget`}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          value={row.raw}
                          aria-invalid={row.invalid}
                          onChange={(e) => setEdits((d) => ({ ...d, [row.id]: e.target.value }))}
                        />
                        <span className="keep-case">{currency}</span>
                      </span>
                    </PlanRow>
                  ))}
                  <PlanRow name="Left to save" group="savings" pct={edited.savings.pct}>
                    {formatAmount(edited.savings.amount, currency)}
                  </PlanRow>
                </ul>
                {edited.hasInvalid && (
                  <p className="error-message" role="alert">
                    Enter each amount as a number, or leave it empty for none.
                  </p>
                )}
                {edited.over > 0 && (
                  <p className="error-message" role="alert">
                    That's {formatAmount(edited.over, currency)} more than your income of{" "}
                    {formatAmount(incomeValue, currency)}. Lower some amounts to fit.
                  </p>
                )}
                {plan.savingsCapped && Object.keys(edits).length === 0 && (
                  <p className="Wizard__hint">
                    We saved a little less than that style usually would, to leave room for everyday
                    costs.
                  </p>
                )}
                <p className="Wizard__hint">
                  These use the default categories. After saving, you can rename them or break them
                  down (say, Food into Coffee and Restaurants) in Categories.
                </p>
              </>
            )
          )}
        </>
      );
      break;
  }

  return (
    <Wizard
      className="BudgetWizard"
      labels={LABELS}
      stepIndex={stepIndex}
      onBack={() => setStepIndex((i) => i - 1)}
      onCancel={onCancel}
      cancelText="Back to budgets"
      onNext={next}
      nextText={step === "plan" ? "Use this plan" : step === "start" ? "Start" : "Next"}
      nextDisabled={!canContinue[step]}
    >
      {body}
    </Wizard>
  );
};

/** What resetting to the default categories will change, or that nothing will. */
const CategoryWarning = ({ reset }: { reset: ReturnType<typeof resetToDefaultsOps> }) => {
  const { added, restored, renamed, archived } = reset.summary;
  const changes = [
    archived.length > 0 && `Archive ${archived.join(", ")} (past entries keep them)`,
    renamed.length > 0 && `Rename ${renamed.join(", ")}`,
    restored.length > 0 && `Restore ${restored.join(", ")}`,
    added.length > 0 && `Add back ${added.join(", ")}`,
  ].filter((line): line is string => !!line);

  if (reset.tooMany) {
    return (
      <p className="error-message">
        This log has too many categories to add the defaults back. Delete some archived categories
        in Categories first.
      </p>
    );
  }
  return (
    <div className="BudgetWizard__warning" role="note">
      <strong>The plan uses the default categories.</strong>{" "}
      {changes.length === 0 ? (
        <span>Your categories already match them, so nothing about them will change.</span>
      ) : (
        <>
          <span>When you save it, your categories will be reset to match:</span>
          <ul>
            {changes.map((line) => (
              <li key={line} className="keep-case">
                {line}
              </li>
            ))}
          </ul>
          <span>Nothing changes until you press Save in the Budgets window.</span>
        </>
      )}
    </div>
  );
};

const AmountField = ({
  label,
  hint,
  value,
  currency,
  onChange,
  autoFocus,
}: {
  label: string;
  hint?: string;
  value: string;
  currency: Currency;
  onChange: (raw: string) => void;
  autoFocus?: boolean;
}) => {
  const invalid = value.trim() !== "" && !isValidMoney(parseOptional(value));
  return (
    <label className="BudgetWizard__field">
      <span>
        {label}
        {hint && <small className="BudgetWizard__fieldHint">{hint}</small>}
      </span>
      <span className="BudgetWizard__amount">
        <input
          className="LineInput"
          aria-label={label}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="keep-case">{currency}</span>
      </span>
    </label>
  );
};

/** Every category plus savings, for the pie. */
const pieData = (edited: EditedPlan, currency: Currency): PieDatum[] => [
  ...edited.rows.map((r) => ({
    id: r.id,
    name: NAME_OF.get(r.id) ?? r.id,
    group: planGroupOf(r.id),
    value: r.amount,
    label: `${r.pct.toFixed(1)}% · ${formatAmount(r.amount, currency)}`,
  })),
  {
    id: "savings",
    name: "Left to save",
    group: "savings" as const,
    value: edited.savings.amount,
    label: `${edited.savings.pct.toFixed(1)}% · ${formatAmount(edited.savings.amount, currency)}`,
  },
];

/** The pie in words, for screen readers: each group's share of income. */
const pieSummary = (edited: EditedPlan): string => {
  const share = (group: PlanGroup) =>
    group === "savings"
      ? edited.savings.pct
      : edited.rows.filter((r) => planGroupOf(r.id) === group).reduce((s, r) => s + r.pct, 0);
  return `Income split: ${PLAN_GROUPS.map((g) => `${g.label} ${share(g.id).toFixed(1)}%`).join(", ")}`;
};

const PlanRow = ({
  name,
  group,
  pct,
  children,
}: {
  name: string;
  group: PlanGroup;
  pct: number;
  /** The amount: an editable field, or plain text for savings. */
  children: ReactNode;
}) => (
  <li
    className={cx("BudgetWizard__planRow", {
      "BudgetWizard__planRow--savings": group === "savings",
    })}
  >
    <Swatch group={group} />
    <span className="BudgetWizard__planName">{name}</span>
    <span className="BudgetWizard__planPct">{pct.toFixed(1)}%</span>
    <span className="BudgetWizard__planAmount">{children}</span>
  </li>
);

export default BudgetWizard;
