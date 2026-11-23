import { CurrencyAmounts, Ledger, LedgerEntry } from "@/types/ledger";
import { Currency, LogPost } from "@/types/user";
import { formatAmount, orderedCurrencies, sumByCurrency } from "@/utils/ledgerEntries";

/**
 * Pulling your own financial-log spending into a social post.
 *
 * It's a one-time copy: the chosen entries become ordinary markdown lines in the post
 * (which the author can reword, reorder or delete) and their totals are added to the
 * post's amount rows. Nothing links back to the ledger except the pull keys in
 * `pulledEntryIds`, kept only to grey out entries already pulled. Never ledger ids:
 * posts are public and a ledger id is enough to join a ledger.
 */

export type PullEntry = Pick<LedgerEntry, "amount" | "currency" | "note"> & {
  /** The entry's pull key (see `pullKey`), not its document id. */
  id: string;
  categoryName: string;
};

export type PullGroup = {
  ledgerId: string;
  title: string;
  entries: PullEntry[];
};

export type LogSelection = "all" | "some" | "none";

const UNCATEGORISED = "uncategorised";

/**
 * An entry's identity for pulling: its document id qualified by its ledger, since the
 * same CSV row imported into two logs gets the same document id in both. Hashed, so a
 * public post's `pulledEntryIds` never reveal the ledger id (cyrb53, 53 bits: plenty
 * against collisions among one author's entries, and not reversible to a ledger id).
 */
export const pullKey = (ledgerId: string, entryId: string): string => {
  const text = `${ledgerId}/${entryId}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `p${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
};

/**
 * Text from a ledger (a note, a category or log name, possibly another member's) shown
 * as itself, not as markdown: no images, links or HTML loading before the author posts.
 */
export const escapeMarkdown = (text: string): string =>
  text
    .replace(/[\\`*_{}[\]()<>#+!|~]/g, "\\$&")
    .replace(/\s+/g, " ")
    .trim();

/** A ledger's entries on a day, with category names resolved, newest-added order kept. */
export const toPullGroup = (
  ledger: Pick<Ledger, "id" | "title" | "categories">,
  entries: ReadonlyArray<Pick<LedgerEntry, "id" | "amount" | "currency" | "note" | "categoryId">>,
): PullGroup => {
  const names = new Map(ledger.categories.map((c) => [c.id, c.name]));
  return {
    ledgerId: ledger.id,
    title: ledger.title,
    entries: entries.map(({ id, amount, currency, note, categoryId }) => ({
      id: pullKey(ledger.id, id),
      amount,
      currency,
      ...(note ? { note } : {}),
      categoryName: names.get(categoryId) ?? UNCATEGORISED,
    })),
  };
};

/** Everything ticked except entries already pulled into one of your posts. */
export const initialSelection = (
  groups: ReadonlyArray<PullGroup>,
  alreadyPulled: ReadonlySet<string>,
): Set<string> =>
  new Set(groups.flatMap((g) => g.entries.map((e) => e.id)).filter((id) => !alreadyPulled.has(id)));

export const logSelection = (group: PullGroup, selected: ReadonlySet<string>): LogSelection => {
  const ticked = group.entries.filter((e) => selected.has(e.id)).length;
  return ticked === 0 ? "none" : ticked === group.entries.length ? "all" : "some";
};

/** The log's own checkbox: a fully ticked log unticks; otherwise every entry ticks. */
export const toggleLog = (group: PullGroup, selected: ReadonlySet<string>): Set<string> => {
  const next = new Set(selected);
  const untick = logSelection(group, selected) === "all";
  for (const { id } of group.entries) {
    if (untick) next.delete(id);
    else next.add(id);
  }
  return next;
};

export const toggleEntry = (id: string, selected: ReadonlySet<string>): Set<string> => {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

const chosen = (groups: ReadonlyArray<PullGroup>, selected: ReadonlySet<string>) =>
  groups
    .map((g) => ({ ...g, entries: g.entries.filter((e) => selected.has(e.id)) }))
    .filter((g) => g.entries.length > 0);

export const selectedTotals = (
  groups: ReadonlyArray<PullGroup>,
  selected: ReadonlySet<string>,
): CurrencyAmounts => sumByCurrency(chosen(groups, selected).flatMap((g) => g.entries));

export const selectedIds = (
  groups: ReadonlyArray<PullGroup>,
  selected: ReadonlySet<string>,
): string[] => chosen(groups, selected).flatMap((g) => g.entries.map((e) => e.id));

/**
 * "- ramen · food — 1,200 JPY", or "- food — 1,200 JPY" when there's no note. The em
 * dash marks the line as pulled: the calculator counts only the amount after it, so a
 * note like "paid $5" isn't counted again.
 */
export const entryLine = ({ note, categoryName, amount, currency }: PullEntry): string =>
  `- ${[note, categoryName]
    .filter(Boolean)
    .map((t) => escapeMarkdown(t!))
    .join(" · ")} — ${formatAmount(amount, currency)}`;

/**
 * The markdown inserted into the post: a bold line per log, then a list line per
 * entry. Amounts use the "1,200 JPY" form the editor's calculator reads.
 */
export const buildPulledMarkdown = (
  groups: ReadonlyArray<PullGroup>,
  selected: ReadonlySet<string>,
): string =>
  chosen(groups, selected)
    .map((g) => [`**${escapeMarkdown(g.title)}**`, ...g.entries.map(entryLine)].join("\n"))
    .join("\n\n");

/** Put pulled lines into the post body: appended after a blank line, or alone. */
export const appendPulled = (content: string, markdown: string): string =>
  content.trim() === "" ? markdown : `${content.replace(/\s+$/, "")}\n\n${markdown}`;

/** Pull keys already pulled into the given author's posts. */
export const pulledIdsIn = (
  posts: ReadonlyArray<Pick<LogPost, "author"> & { pulledEntryIds?: string[] }>,
  authorDocId: string | undefined,
): Set<string> =>
  new Set(
    authorDocId
      ? posts.filter((p) => p.author?.id === authorDocId).flatMap((p) => p.pulledEntryIds ?? [])
      : [],
  );

type Row = { currency: Currency; amount: number };

/**
 * Add pulled totals into the editor's amount rows: onto a row in the same currency, or
 * as a new row. A lone untouched row (0, in a currency nothing was pulled in) is
 * replaced rather than left as a 0 primary.
 */
export const mergeIntoRows = (rows: ReadonlyArray<Row>, totals: CurrencyAmounts): Row[] => {
  const pulled = orderedCurrencies(totals);
  if (pulled.length === 0) return [...rows];
  const base =
    rows.length === 1 && rows[0].amount === 0 && totals[rows[0].currency] === undefined
      ? []
      : rows.map((r) => ({ ...r }));
  for (const currency of pulled) {
    const add = totals[currency]!;
    const row = base.find((r) => r.currency === currency);
    if (row) row.amount = Math.round((row.amount + add) * 100) / 100;
    else base.push({ currency, amount: add });
  }
  return base;
};
