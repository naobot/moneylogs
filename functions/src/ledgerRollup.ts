/**
 * Pure planning for sublogs: a ledger (the child) that also counts as one category of
 * another ledger (the parent).
 *
 * The child's entries stay the single source of truth. For each month, the child's
 * entries by people who are also members of the parent are aggregated into
 * ledgers/{parent}/rollups/{YYYY-MM}__{childId}, under the parent's linked category. The
 * parent's months/ summary is its own aggregate merged with that month's roll-ups.
 *
 * Shared by the Cloud Functions and the web app; keep it dependency-free apart from
 * ledgerAggregate.
 */
import {
  aggregateMonth,
  AggregatableEntry,
  Amounts,
  isAggregatable,
  MonthAggregate,
} from "./ledgerAggregate";

/** Same cap as MAX_CATEGORIES in src/utils/ledgerCategories.ts (and firestore.rules). */
export const MAX_LEDGER_CATEGORIES = 50;
/** Same cap as category names in src/utils/ledgerCategories.ts. */
export const MAX_CATEGORY_NAME = 20;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonthKey = (m: unknown): m is string => typeof m === "string" && MONTH_RE.test(m);

/** ledgers/{child}.parentLink, written only by the linkSublog / unlinkSublog functions. */
export type ParentLink = {
  ledgerId: string;
  categoryId: string;
  /** "YYYY-MM": the first month that rolls up. Earlier months stay in the child only. */
  since: string;
  linkedBy: string;
};

/** A parent category's `sublog` marker. `unlinkedAt` set: past months only, now frozen. */
export type SublogMarker = { ledgerId: string; linkedAt?: unknown; unlinkedAt?: unknown };

export type LinkableCategory = {
  id: string;
  name: string;
  order: number;
  archived?: boolean;
  sublog?: SublogMarker;
};

export type LinkableLedger = {
  id: string;
  title?: string;
  memberUids?: string[];
  categories?: LinkableCategory[];
  parentLink?: ParentLink;
  deleting?: boolean;
};

/** A month's roll-up: the aggregate plus how many entries fell on each day ("DD"). */
export type RollupAggregate = MonthAggregate & { countByDay: { [day: string]: number } };

export type RollupDoc = RollupAggregate & {
  month: string;
  childId: string;
  categoryId: string;
  /** Set when the link ended: the month keeps its totals and is never rebuilt. */
  frozen?: boolean;
};

export const rollupDocId = (month: string, childId: string) => `${month}__${childId}`;

/** The categories that are (or were) sublogs, i.e. whether this ledger may have roll-ups. */
export const hasSublogCategories = (categories: unknown): boolean =>
  Array.isArray(categories) &&
  categories.some((c) => !!c && typeof c === "object" && "sublog" in c && !!c.sublog);

/** A category linked to a sublog right now (not unlinked). */
export const isActiveSublog = (c: Pick<LinkableCategory, "sublog">): boolean =>
  !!c.sublog && !c.sublog.unlinkedAt;

/**
 * Aggregate one child month for the parent: only entries whose author is also in the
 * parent, all filed under the parent's linked category.
 */
export const rollupFor = (
  entries: ReadonlyArray<Partial<AggregatableEntry>>,
  parentMemberUids: ReadonlyArray<string>,
  categoryId: string,
): RollupAggregate => {
  const members = new Set(parentMemberUids);
  const counted = entries
    .filter((e) => typeof e.authorUid === "string" && members.has(e.authorUid))
    .map((e) => ({ ...e, categoryId }));
  const countByDay: { [day: string]: number } = {};
  for (const e of counted) {
    if (!isAggregatable(e)) continue;
    const day = e.date.slice(8, 10);
    countByDay[day] = (countByDay[day] ?? 0) + 1;
  }
  return { ...aggregateMonth(counted), countByDay };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const addAmounts = (into: Amounts, from: Amounts | undefined) => {
  for (const [currency, amount] of Object.entries(from ?? {})) {
    if (typeof amount !== "number" || !isFinite(amount)) continue;
    into[currency] = round2((into[currency] ?? 0) + amount);
  }
};

const addBuckets = (
  into: { [key: string]: Amounts },
  from: { [key: string]: Amounts } | undefined,
) => {
  for (const [key, amounts] of Object.entries(from ?? {})) {
    addAmounts((into[key] = into[key] ?? {}), amounts);
  }
};

export type MergedMonth = MonthAggregate & {
  /** Entries that came in from sublogs, per linked category. Not in entryCount. */
  rolledUp: { [categoryId: string]: number };
};

/**
 * The parent's month: its own aggregate plus every roll-up for the month. `entryCount`
 * stays the parent's own entries; sublog entries are counted in `rolledUp`.
 */
export const mergeRollups = (
  own: MonthAggregate,
  rollups: ReadonlyArray<Partial<RollupDoc>>,
): MergedMonth => {
  const merged: MergedMonth = {
    entryCount: own.entryCount,
    totals: { ...own.totals },
    byCategory: Object.fromEntries(Object.entries(own.byCategory).map(([k, v]) => [k, { ...v }])),
    byMember: Object.fromEntries(Object.entries(own.byMember).map(([k, v]) => [k, { ...v }])),
    byDay: Object.fromEntries(Object.entries(own.byDay).map(([k, v]) => [k, { ...v }])),
    rolledUp: {},
  };
  for (const r of rollups) {
    if (!r.categoryId || !r.entryCount) continue;
    addAmounts(merged.totals, r.totals);
    addBuckets(merged.byCategory, r.byCategory);
    addBuckets(merged.byMember, r.byMember);
    addBuckets(merged.byDay, r.byDay);
    merged.rolledUp[r.categoryId] = (merged.rolledUp[r.categoryId] ?? 0) + r.entryCount;
  }
  return merged;
};

export type LinkError =
  | "same-log"
  | "not-member"
  | "deleting"
  | "personal-child"
  | "child-already-linked"
  | "child-is-parent"
  | "parent-is-sublog"
  | "too-many-categories";

/** Why `child` can't become a sublog of `parent` for this caller, or null if it can. */
export const validateLink = ({
  parent,
  child,
  callerUid,
}: {
  parent: LinkableLedger;
  child: LinkableLedger;
  callerUid: string;
}): LinkError | null => {
  if (parent.id === child.id) return "same-log";
  if (!parent.memberUids?.includes(callerUid) || !child.memberUids?.includes(callerUid)) {
    return "not-member";
  }
  if (parent.deleting || child.deleting) return "deleting";
  // A personal log is everyone's top level; it can be a parent, never a sublog.
  if (child.id.startsWith("personal-")) return "personal-child";
  if (child.parentLink) return "child-already-linked";
  // One level only: a sublog has no sublogs, and a parent is never itself a sublog.
  if ((child.categories ?? []).some(isActiveSublog)) return "child-is-parent";
  if (parent.parentLink) return "parent-is-sublog";
  if ((parent.categories ?? []).length >= MAX_LEDGER_CATEGORIES) return "too-many-categories";
  return null;
};

export const LINK_ERROR_MESSAGES: Record<LinkError, string> = {
  "same-log": "A log can't be its own sublog.",
  "not-member": "You need to be a member of both logs.",
  deleting: "One of these logs is being deleted.",
  "personal-child": "Your personal log can't be a sublog.",
  "child-already-linked": "This log is already part of another log.",
  "child-is-parent": "This log has sublogs of its own, so it can't be a sublog.",
  "parent-is-sublog": "That log is itself a sublog.",
  "too-many-categories": "That log already has the most categories it can hold.",
};

/** The linked category's name: what the user typed, else the child's title, trimmed. */
export const linkedCategoryName = (name: unknown, childTitle: string | undefined): string => {
  const chosen = typeof name === "string" && name.trim() ? name.trim() : (childTitle ?? "").trim();
  return (chosen || "sublog").slice(0, MAX_CATEGORY_NAME);
};

/**
 * The parent's categories with the linked one added at the end of the active list. The id
 * is derived from the child, with a suffix if an earlier (unlinked) link already used it.
 */
export const addLinkedCategory = (
  categories: ReadonlyArray<LinkableCategory>,
  {
    childId,
    name,
    linkedAt,
  }: {
    childId: string;
    name: string;
    linkedAt: unknown;
  },
): { categories: LinkableCategory[]; categoryId: string } => {
  const taken = new Set(categories.map((c) => c.id));
  const base = `sublog-${childId}`;
  let categoryId = base;
  for (let n = 2; taken.has(categoryId); n++) categoryId = `${base}-${n}`;
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const added: LinkableCategory = {
    id: categoryId,
    name,
    order: 0,
    sublog: { ledgerId: childId, linkedAt },
  };
  const next = [...active, added, ...archived].map((c, order) => ({ ...c, order }));
  return { categories: next, categoryId };
};

/** The parent's categories with the link to `childId` marked as ended. */
export const markCategoryUnlinked = (
  categories: ReadonlyArray<LinkableCategory>,
  childId: string,
  unlinkedAt: unknown,
): LinkableCategory[] =>
  categories.map((c) =>
    c.sublog?.ledgerId === childId && !c.sublog.unlinkedAt
      ? { ...c, sublog: { ...c.sublog, unlinkedAt } }
      : c,
  );

/** The months a link covers, from a child's month keys. */
export const monthsSince = (months: ReadonlyArray<string>, since: string): string[] =>
  months.filter((m) => isMonthKey(m) && m >= since).sort();

export type LinkRequest = {
  childId: string;
  parentId: string;
  name?: string;
  since: string;
};

export const parseLinkRequest = (data: unknown): LinkRequest | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.childId !== "string" || !d.childId) return null;
  if (typeof d.parentId !== "string" || !d.parentId) return null;
  if (!isMonthKey(d.since)) return null;
  if (d.name !== undefined && typeof d.name !== "string") return null;
  return {
    childId: d.childId,
    parentId: d.parentId,
    since: d.since,
    ...(typeof d.name === "string" ? { name: d.name } : {}),
  };
};

/** People whose spending in the sublog counts in the parent: members of both logs. */
export const countedUids = (
  childUids: ReadonlyArray<string> | undefined,
  parentUids: ReadonlyArray<string> | undefined,
): string[] => {
  const parent = new Set(parentUids ?? []);
  return [...new Set(childUids ?? [])].filter((uid) => parent.has(uid));
};

/**
 * Who a membership change starts counting: in both logs after it, not before. They're
 * told (a `sublog_counted` notification), since their spending now shows in a log whose
 * other members may not be in the sublog.
 */
export const newlyCountedUids = (
  before: { child?: ReadonlyArray<string>; parent?: ReadonlyArray<string> },
  after: { child?: ReadonlyArray<string>; parent?: ReadonlyArray<string> },
): string[] => {
  const was = new Set(countedUids(before.child, before.parent));
  return countedUids(after.child, after.parent).filter((uid) => !was.has(uid));
};

/** One per sublog and parent: a later link or join replaces it rather than stacking. */
export const sublogCountedNotificationId = (childId: string, parentId: string) =>
  `sublog_counted_${childId}_${parentId}`;
