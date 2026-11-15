import { describe, it, expect } from "vite-plus/test";
import {
  planBudget,
  resetToDefaultsOps,
  roundingStep,
  SAVING_STYLES,
  SavingStyleId,
} from "@/features/ledger/budgetWizard/budgetPlan";
import { DEFAULT_CATEGORIES } from "@/utils/ledger";
import { applyCategoryOps } from "@/utils/ledgerCategories";
import { LedgerCategory } from "@/types/ledger";

const plan = (overrides: Partial<Parameters<typeof planBudget>[0]> = {}) => {
  const result = planBudget({
    income: 400_000,
    housing: 100_000,
    utilities: 15_000,
    style: "steady",
    seed: 1,
    ...overrides,
  });
  if (!result.ok) throw new Error("expected a plan");
  return result;
};
const amountOf = (p: ReturnType<typeof plan>, id: string) =>
  p.rows.find((r) => r.id === id)!.amount;

describe("planBudget", () => {
  it("covers every default category in order and adds up to the income", () => {
    const p = plan();
    expect(p.rows.map((r) => r.id)).toEqual(DEFAULT_CATEGORIES.map((c) => c.id));
    const total = p.rows.reduce((s, r) => s + r.amount, 0) + p.savings.amount;
    expect(total).toBeCloseTo(400_000, 2);
    const pcts = p.rows.reduce((s, r) => s + r.pct, 0) + p.savings.pct;
    expect(Math.abs(pcts - 100)).toBeLessThanOrEqual(0.5); // each % rounds on its own
    expect(p.savings.pct).toBeCloseTo((p.savings.amount / 400_000) * 100, 1);
  });

  it("keeps housing and utilities exactly as entered", () => {
    const p = plan();
    expect(amountOf(p, "housing")).toBe(100_000);
    expect(amountOf(p, "utilities")).toBe(15_000);
  });

  it.each(SAVING_STYLES.map((s) => [s.id, s.savings] as const))(
    "saves within the %s range (plus rounding leftovers)",
    (style, [min, max]) => {
      for (let seed = 1; seed <= 20; seed++) {
        const p = plan({ style: style as SavingStyleId, seed });
        const rate = p.savings.amount / 400_000;
        expect(rate).toBeGreaterThanOrEqual(min - 1e-9);
        // Rounding to whole steps leaves less than one step over for savings.
        expect(rate).toBeLessThan(max + roundingStep(400_000) / 400_000);
      }
    },
  );

  it("gives discretionary categories less when saving hard", () => {
    const discretionary = (style: SavingStyleId) => {
      let sum = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const p = plan({ style, seed });
        sum += ["food", "shopping", "entertainment", "travel"].reduce(
          (s, id) => s + amountOf(p, id),
          0,
        );
      }
      return sum;
    };
    expect(discretionary("frugal")).toBeLessThan(discretionary("relaxed"));
  });

  it("rounds suggestions to a step that suits the income", () => {
    expect(roundingStep(400_000)).toBe(1000);
    expect(roundingStep(4_000)).toBe(10);
    expect(roundingStep(50)).toBe(1);
    const p = plan({ income: 4_000, housing: 1_500, utilities: 150 });
    for (const id of ["groceries", "food", "travel", "other"]) {
      expect(amountOf(p, id) % 10).toBe(0);
    }
  });

  it("is repeatable for a seed and changes on a re-roll", () => {
    expect(plan({ seed: 7 })).toEqual(plan({ seed: 7 }));
    expect(plan({ seed: 7 }).rows).not.toEqual(plan({ seed: 8 }).rows);
  });

  it("refuses when housing and utilities take the whole income", () => {
    expect(
      planBudget({ income: 1000, housing: 900, utilities: 100, style: "steady", seed: 1 }),
    ).toEqual({ ok: false, error: "fixed-costs-too-high" });
  });

  it("lowers savings to leave room for everyday spending, and says so", () => {
    const p = plan({ income: 1000, housing: 700, utilities: 100, style: "frugal" });
    expect(p.savingsCapped).toBe(true);
    // 200 left after fixed costs; at least 150 (15%) stays for everyday categories.
    const everyday = p.rows
      .filter((r) => r.id !== "housing" && r.id !== "utilities")
      .reduce((s, r) => s + r.amount, 0);
    expect(everyday).toBe(150);
    expect(plan().savingsCapped).toBe(false);
  });
});

describe("resetToDefaultsOps", () => {
  const defaults = (): LedgerCategory[] => DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  const resetResult = (categories: LedgerCategory[]) => {
    const reset = resetToDefaultsOps(categories);
    const after = applyCategoryOps(categories, reset.ops);
    const active = after.filter((c) => !c.archived).sort((a, b) => a.order - b.order);
    return { reset, after, active };
  };
  const defaultNames = DEFAULT_CATEGORIES.map((c) => c.name);

  it("does nothing when the categories are already the defaults", () => {
    const { reset } = resetResult(defaults());
    expect(reset.ops).toEqual([]);
    expect(reset.summary).toEqual({ added: [], restored: [], renamed: [], archived: [] });
  });

  it("adds deleted, restores archived, renames back, archives custom, and reorders", () => {
    const categories: LedgerCategory[] = [
      { id: "coffee", name: "Coffee", order: 0 },
      ...defaults()
        .filter((c) => c.id !== "travel")
        .map((c, i) => ({
          ...c,
          order: 10 - i,
          ...(c.id === "food" && { name: "Eating out" }),
          ...(c.id === "health" && { archived: true }),
        })),
    ];
    const { reset, after, active } = resetResult(categories);
    expect(active.map((c) => c.name)).toEqual(defaultNames);
    expect(after.find((c) => c.id === "coffee")?.archived).toBe(true); // archived, not deleted
    expect(reset.summary).toEqual({
      added: ["Travel"],
      restored: ["Health"],
      renamed: ["Eating out → Food"],
      archived: ["Coffee"],
    });
  });

  it("reuses a re-created default matched by name, keeping its id", () => {
    const categories = defaults().map((c) =>
      c.id === "food" ? { ...c, id: "food-2", name: "food" } : c,
    );
    const { reset, active } = resetResult(categories);
    expect(reset.idFor.food).toBe("food-2");
    expect(reset.summary.added).toEqual([]);
    expect(active.map((c) => c.name)).toEqual(defaultNames);
  });

  it("flags when restoring the defaults would pass the category cap", () => {
    const many: LedgerCategory[] = Array.from({ length: 48 }, (_, i) => ({
      id: `c${i}`,
      name: `C${i}`,
      order: i,
      archived: i > 0,
    }));
    expect(resetToDefaultsOps(many).tooMany).toBe(true);
    expect(resetToDefaultsOps(defaults()).tooMany).toBe(false);
  });
});
