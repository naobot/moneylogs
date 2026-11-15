import { LedgerCategory } from "@/types/ledger";
import { DEFAULT_CATEGORIES, normaliseCategoryName } from "@/utils/ledger";
import { parseAmount } from "@/utils/ledgerEntries";
import { applyCategoryOps, CategoryOp, MAX_BUDGET, MAX_CATEGORIES } from "@/utils/ledgerCategories";

/**
 * The budget helper: turns income, housing, utilities and a saving style into suggested
 * monthly budgets for the default categories. Pure and seeded, so a plan can be
 * re-rolled (new seed) and tests are deterministic.
 */

export type SavingStyleId = "frugal" | "steady" | "comfort" | "relaxed";

export type SavingStyle = {
  id: SavingStyleId;
  /** How the user would say it. */
  label: string;
  /** Savings as a share of income, picked within this range on each roll. */
  savings: [number, number];
  /** Multiplier on discretionary categories (eating out, shopping, fun, travel). */
  discretionary: number;
};

export const SAVING_STYLES: ReadonlyArray<SavingStyle> = [
  {
    id: "frugal",
    label: "I want to live frugally and save a lot",
    savings: [0.25, 0.35],
    discretionary: 0.65,
  },
  {
    id: "steady",
    label: "I want to save steadily and still enjoy myself",
    savings: [0.15, 0.22],
    discretionary: 0.9,
  },
  {
    id: "comfort",
    label: "I'd like to save a little, but comfort comes first",
    savings: [0.05, 0.12],
    discretionary: 1.1,
  },
  {
    id: "relaxed",
    label: "I just want to keep my spending in check for now",
    savings: [0, 0.03],
    discretionary: 1.25,
  },
];

/** Category ids the plan fixes from the user's answers rather than allotting. */
export const FIXED_IDS = ["housing", "utilities"] as const;

/** Relative shares of what's left after housing, utilities and savings. */
const BASE_WEIGHTS: Record<string, number> = {
  groceries: 22,
  transport: 18,
  food: 12,
  shopping: 12,
  health: 10,
  entertainment: 9,
  travel: 9,
  other: 8,
};
const DISCRETIONARY = new Set(["food", "shopping", "entertainment", "travel"]);

/** How the plan groups categories for its chart: what's fixed, needed, chosen, kept. */
export type PlanGroup = "fixed" | "essentials" | "lifestyle" | "savings";

export const PLAN_GROUPS: ReadonlyArray<{ id: PlanGroup; label: string }> = [
  { id: "fixed", label: "Housing & utilities" },
  { id: "essentials", label: "Essentials" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "savings", label: "Left to save" },
];

/** The chart group of a default category id ("savings" is its own pseudo-row). */
export const planGroupOf = (id: string): PlanGroup =>
  id === "savings"
    ? "savings"
    : (FIXED_IDS as ReadonlyArray<string>).includes(id)
      ? "fixed"
      : DISCRETIONARY.has(id)
        ? "lifestyle"
        : "essentials";

/** One slice of the plan's pie: a category (or savings), its group, value and label. */
export type PieDatum = { id: string; name: string; group: PlanGroup; value: number; label: string };

export type PieSlice = PieDatum & { start: number; end: number };

/** Slices in group order, as angles in radians clockwise from 12 o'clock; zeros dropped. */
export const pieSlices = (data: ReadonlyArray<PieDatum>): PieSlice[] => {
  const order = PLAN_GROUPS.map((g) => g.id);
  const shown = data
    .filter((d) => d.value > 0)
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  const total = shown.reduce((s, d) => s + d.value, 0);
  let angle = 0;
  return shown.map((d) => {
    const start = angle;
    angle += (d.value / total) * 2 * Math.PI;
    return { ...d, start, end: angle };
  });
};

/** At least this share of income is left for everyday categories; savings give way. */
export const MIN_EVERYDAY_SHARE = 0.15;

export type PlanRow = { id: string; amount: number; pct: number };

export type BudgetPlan =
  | {
      ok: true;
      /** Every default category, in default order. */
      rows: PlanRow[];
      savings: { amount: number; pct: number };
      /** Set when the style's savings rate had to be lowered to leave room. */
      savingsCapped: boolean;
    }
  | { ok: false; error: "fixed-costs-too-high" };

/** mulberry32: a tiny seeded PRNG, uniform in [0, 1). */
export const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A rounding step that suits the income: USD 4,000 → 10, JPY 300,000 → 1,000. */
export const roundingStep = (income: number): number =>
  income >= 100 ? 10 ** (Math.floor(Math.log10(income)) - 2) : 1;

/**
 * Split `total` by weight into whole steps (largest remainder): everyone gets their
 * floor, then the spare steps go to the shares that were rounded down the most. The
 * result falls short of `total` by less than one step.
 */
const allotInSteps = (
  total: number,
  weights: ReadonlyArray<readonly [string, number]>,
  totalWeight: number,
  step: number,
): Map<string, number> => {
  const exact = weights.map(([id, w]) => [id, (total * w) / totalWeight / step] as const);
  const steps = new Map(exact.map(([id, x]) => [id, Math.floor(x)]));
  let spare = Math.floor(total / step) - [...steps.values()].reduce((s, n) => s + n, 0);
  for (const [id] of [...exact].sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
    if (spare-- <= 0) break;
    steps.set(id, steps.get(id)! + 1);
  }
  return new Map([...steps].map(([id, n]) => [id, n * step]));
};

const pctOf = (amount: number, income: number) => Math.round((amount / income) * 1000) / 10;

export const planBudget = ({
  income,
  housing,
  utilities,
  style,
  seed,
}: {
  income: number;
  housing: number;
  utilities: number;
  style: SavingStyleId;
  seed: number;
}): BudgetPlan => {
  const fixed = housing + utilities;
  if (!(income > 0) || fixed >= income) return { ok: false, error: "fixed-costs-too-high" };

  const { savings: range, discretionary } = SAVING_STYLES.find((s) => s.id === style)!;
  const random = seededRandom(seed);

  const targetRate = range[0] + (range[1] - range[0]) * random();
  const maxSavings = Math.max(0, income - fixed - income * MIN_EVERYDAY_SHARE);
  const targetSavings = income * targetRate;
  const savingsCapped = targetSavings > maxSavings;
  const everyday = income - fixed - Math.min(targetSavings, maxSavings);

  // Jittered weights, discretionary ones scaled by the saving style.
  const weights = Object.entries(BASE_WEIGHTS).map(([id, base]) => {
    const jitter = 0.75 + random() * 0.5;
    return [id, base * jitter * (DISCRETIONARY.has(id) ? discretionary : 1)] as const;
  });
  const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
  const allotted = allotInSteps(everyday, weights, totalWeight, roundingStep(income));

  const amountFor = (id: string) =>
    id === "housing" ? housing : id === "utilities" ? utilities : (allotted.get(id) ?? 0);
  const rows = DEFAULT_CATEGORIES.map(({ id }) => ({
    id,
    amount: amountFor(id),
    pct: pctOf(amountFor(id), income),
  }));
  // Savings take whatever's left, including rounding leftovers, so it all adds up.
  const savingsAmount = Math.round((income - rows.reduce((s, r) => s + r.amount, 0)) * 100) / 100;
  return {
    ok: true,
    rows,
    // Each % is rounded on its own, so the column can sum to 99.9 or 100.1.
    savings: { amount: savingsAmount, pct: pctOf(savingsAmount, income) },
    savingsCapped,
  };
};

export type EditedRow = PlanRow & {
  /** What the amount field shows: the user's text if edited, else the suggestion. */
  raw: string;
  invalid: boolean;
};

export type EditedPlan = {
  rows: EditedRow[];
  savings: { amount: number; pct: number };
  /** How far the amounts go past the income (0 when they fit). */
  over: number;
  hasInvalid: boolean;
};

/**
 * The suggested plan with the user's in-place edits (raw field text by category id)
 * applied: amounts and %s recomputed, savings taking whatever's left. Empty counts as
 * zero; anything else must be a number. The total may not pass the income.
 */
export const editPlan = (
  rows: ReadonlyArray<PlanRow>,
  edits: Record<string, string>,
  income: number,
): EditedPlan => {
  const edited = rows.map((row) => {
    const raw = edits[row.id] ?? String(row.amount);
    const parsed = raw.trim() === "" ? 0 : parseAmount(raw);
    const invalid = !(Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_BUDGET);
    const amount = invalid ? 0 : Math.round(parsed * 100) / 100;
    return { id: row.id, raw, invalid, amount, pct: pctOf(amount, income) };
  });
  const spent = edited.reduce((s, r) => s + r.amount, 0);
  const left = Math.round((income - spent) * 100) / 100;
  return {
    rows: edited,
    savings: { amount: Math.max(0, left), pct: pctOf(Math.max(0, left), income) },
    over: Math.max(0, -left),
    hasInvalid: edited.some((r) => r.invalid),
  };
};

const sameName = (a: string, b: string) =>
  normaliseCategoryName(a).toLowerCase() === normaliseCategoryName(b).toLowerCase();

export type DefaultsReset = {
  /** Replay these to turn the current categories into the defaults. */
  ops: CategoryOp[];
  /** Default category id → the id of the category playing that role in this log. */
  idFor: Record<string, string>;
  /** What will change, by category name, for the warning. */
  summary: { added: string[]; restored: string[]; renamed: string[]; archived: string[] };
  /** Adding the missing defaults would go over the category cap. */
  tooMany: boolean;
};

/**
 * The category ops that reset a log to the default categories: missing defaults added,
 * archived ones restored, renamed ones renamed back, other categories archived (never
 * deleted, so past entries keep them), and the default order restored. A default is
 * matched by id, else by name, so a re-created "Food" plays Food's part.
 */
export const resetToDefaultsOps = (categories: ReadonlyArray<LedgerCategory>): DefaultsReset => {
  const summary: DefaultsReset["summary"] = { added: [], restored: [], renamed: [], archived: [] };
  const idFor: Record<string, string> = {};
  const restoring: CategoryOp[] = [];
  const renaming: CategoryOp[] = [];
  const claimed = new Set<string>();

  for (const def of DEFAULT_CATEGORIES) {
    const match =
      categories.find((c) => c.id === def.id) ??
      categories.find((c) => !claimed.has(c.id) && sameName(c.name, def.name));
    if (!match) {
      idFor[def.id] = def.id;
      restoring.push({ type: "add", id: def.id, name: def.name });
      summary.added.push(def.name);
      continue;
    }
    claimed.add(match.id);
    idFor[def.id] = match.id;
    if (match.archived) {
      restoring.push({ type: "unarchive", id: match.id });
      summary.restored.push(def.name);
    }
    if (match.name !== def.name) {
      renaming.push({ type: "rename", id: match.id, name: def.name });
      summary.renamed.push(`${match.name} → ${def.name}`);
    }
  }

  const archiving: CategoryOp[] = [];
  for (const c of categories) {
    if (claimed.has(c.id) || c.archived) continue;
    archiving.push({ type: "archive", id: c.id });
    summary.archived.push(c.name);
  }

  // Restore before archiving, so there's never a moment with no active category.
  const ops = [...restoring, ...renaming, ...archiving];
  let list = applyCategoryOps(categories, ops);
  DEFAULT_CATEGORIES.forEach((def, toIndex) => {
    const id = idFor[def.id];
    const active = list.filter((c) => !c.archived).sort((a, b) => a.order - b.order);
    if (active[toIndex]?.id === id) return;
    const move: CategoryOp = { type: "move", id, toIndex };
    ops.push(move);
    list = applyCategoryOps(list, [move]);
  });

  return {
    ops,
    idFor,
    summary,
    tooMany: categories.length + summary.added.length > MAX_CATEGORIES,
  };
};
