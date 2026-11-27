import { useEffect, useMemo, useRef, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import CurrencySelect from "@/components/CurrencySelect";
import { useToastContext } from "@/hooks/useToastContext";
import { Ledger } from "@/types/ledger";
import { Currency } from "@/types/user";
import { entryCategories, formatMonth } from "@/utils/ledger";
import dayjs from "@/utils/configuredDayjs";
import { formatDate } from "@/utils/dateFormat";
import { formatAmount, formatTotals } from "@/utils/ledgerEntries";
import { reportError, trackStep } from "@/utils/reportError";
import { parseCsv } from "./csv";
import { DateOrder } from "./dates";
import { ImportErrorCode, ImportFormatError } from "./errors";
import { ImportProgress, checkImport, importEntries } from "./importEntries";
import { ParsedImportFile, detectSource, parseImportFile } from "./parseImportFile";
import {
  CategoryMapping,
  ImportCheck,
  SKIP,
  initialMapping,
  mapRows,
  previewByMonth,
  readSavedMapping,
  saveMapping,
  sourceCategories,
  splitChecked,
} from "./plan";
import { decodeBytes } from "./text";
import { ImportSource, SkipReason } from "./types";

import "./ImportModal.scss";
import { track } from "@/utils/analytics";

const SOURCE_LABELS: Record<ImportSource, string> = {
  moneyforward: "MoneyForward ME",
  ynab: "YNAB",
};

type ParseError = ImportErrorCode | "unexpected";

const ERROR_MESSAGES: Record<Exclude<ParseError, "ambiguous-dates">, string> = {
  empty: "That file has no rows to import.",
  unexpected: "Something went wrong reading that file.",
  "unknown-format": "That doesn't look like a MoneyForward ME or YNAB export.",
  "missing-columns":
    "Some columns the importer needs are missing. Export the file again and import it without editing.",
};

const SKIP_LABELS: Record<SkipReason, string> = {
  transfer: "transfers",
  income: "income",
  excluded: "excluded",
  invalid: "unreadable",
};

type ImportModalProps = {
  isOpen: boolean;
  ledger: Ledger;
  onClose: () => void;
};

type Parsed = { file: ParsedImportFile } | { error: ParseError; cause?: unknown };

/** The duplicate check's outcome for one parse of the file (a re-parse re-checks). */
type Checked = { file: ParsedImportFile; result: ImportCheck | "failed" };

/** Column labels only (never row data), trimmed, to spot an export format that changed. */
const headerColumns = (text: string): string[] =>
  (parseCsv(text.slice(0, 2000))[0] ?? []).slice(0, 20).map((h) => h.trim().slice(0, 30));

/**
 * Import spending from a MoneyForward ME or YNAB CSV export into this ledger as the
 * current user's entries: pick a file, map its categories, check the preview, import.
 */
export const ImportModal = (props: ImportModalProps) =>
  // Remount on open so each import starts from a clean slate.
  props.isOpen ? <ImportDialog {...props} /> : null;

const ImportDialog = ({ ledger, onClose }: ImportModalProps) => {
  const { showToast } = useToastContext();
  const [text, setText] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [readFailed, setReadFailed] = useState(false);
  const [currency, setCurrency] = useState<Currency>(ledger.defaultCurrency);
  const [dateOrder, setDateOrder] = useState<DateOrder>();
  // Only the rows the user changed; the rest come from initialMapping.
  const [picked, setPicked] = useState<CategoryMapping>({});
  const [progress, setProgress] = useState<ImportProgress>();
  const [importFailed, setImportFailed] = useState(false);
  const [checked, setChecked] = useState<Checked>();
  // Flagged rows the user ticked to import anyway.
  const [included, setIncluded] = useState<ReadonlySet<string>>(new Set());

  const categories = useMemo(() => ledger.categories ?? [], [ledger.categories]);
  const active = entryCategories(categories);
  const isImporting = progress !== undefined && !importFailed;

  const parsed = useMemo<Parsed | undefined>(() => {
    if (text === undefined) return undefined;
    try {
      return { file: parseImportFile(text, { currency, dateOrder }) };
    } catch (err) {
      if (err instanceof ImportFormatError) return { error: err.code };
      return { error: "unexpected", cause: err };
    }
  }, [text, currency, dateOrder]);

  // Tell Sentry when a supported app's export no longer reads cleanly (its format may have
  // changed) or parsing broke. Once per file and date order; never a user's wrong file.
  const reportedFor = useRef<string>();
  useEffect(() => {
    if (!parsed || text === undefined) return;
    const key = `${fileName}|${text.length}|${dateOrder ?? ""}`;
    if (reportedFor.current === key) return;
    reportedFor.current = key;

    if ("file" in parsed) {
      const { source, rows, skipped } = parsed.file;
      trackStep("ledger_import", "Import file read", { source, rows: rows.length, ...skipped });
      if (skipped.invalid > 0) {
        reportError(new Error("Import file had unreadable rows"), {
          feature: "ledger_import",
          action: "parse_file",
          level: "warning",
          tags: { source },
          extra: { invalid: skipped.invalid, kept: rows.length, columns: headerColumns(text) },
        });
      }
    } else if (parsed.error === "missing-columns") {
      const columns = headerColumns(text);
      reportError(new Error("Import file is missing expected columns"), {
        feature: "ledger_import",
        action: "parse_file",
        level: "warning",
        tags: { source: detectSource(columns) ?? "unknown" },
        extra: { columns },
      });
    } else if (parsed.error === "unexpected") {
      reportError(parsed.cause, {
        feature: "ledger_import",
        action: "parse_file",
        extra: { columns: headerColumns(text) },
      });
    } else {
      trackStep("ledger_import", "Import file not usable", { reason: parsed.error });
    }
  }, [parsed, text, fileName, dateOrder]);

  const file = parsed && "file" in parsed ? parsed.file : undefined;

  // Before anything is mapped, ask which rows are already in the ledger.
  useEffect(() => {
    if (!file || file.rows.length === 0) return;
    let cancelled = false;
    checkImport({ ledgerId: ledger.id, source: file.source, rows: file.rows }).then(
      (result) => {
        if (cancelled) return;
        trackStep("ledger_import", "Import checked", {
          alreadyImported: result.alreadyImported.size,
          possibleDuplicates: Object.keys(result.possibleDuplicates).length,
        });
        setChecked({ file, result });
      },
      (err: unknown) => {
        if (cancelled) return;
        reportError(err, {
          feature: "ledger_import",
          action: "check_duplicates",
          level: "warning",
          tags: { source: file.source },
          extra: { rows: file.rows.length },
        });
        setChecked({ file, result: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file, ledger.id]);

  const checkResult = checked && checked.file === file ? checked.result : undefined;
  const isChecking = !!file && file.rows.length > 0 && checkResult === undefined;
  const check = checkResult && checkResult !== "failed" ? checkResult : undefined;
  const split = useMemo(
    () => (file ? splitChecked(file.rows, check, included) : undefined),
    [file, check, included],
  );
  const sources = useMemo(() => (split ? sourceCategories(split.fresh) : []), [split]);
  const mapping = useMemo<CategoryMapping>(
    () =>
      file
        ? {
            ...initialMapping(sources, categories, readSavedMapping(ledger.id, file.source)),
            ...picked,
          }
        : {},
    [file, sources, categories, ledger.id, picked],
  );
  const rows = useMemo(() => (split ? mapRows(split.toImport, mapping) : []), [split, mapping]);
  const months = useMemo(() => previewByMonth(rows), [rows]);
  const skippedByMapping = (split?.toImport.length ?? 0) - rows.length;

  const toggleIncluded = (externalId: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (!next.delete(externalId)) next.add(externalId);
      return next;
    });

  const handleFile = async (chosen: File | undefined) => {
    setReadFailed(false);
    setPicked({});
    setIncluded(new Set());
    setDateOrder(undefined);
    if (!chosen) {
      setText(undefined);
      return;
    }
    setFileName(chosen.name);
    try {
      setText(decodeBytes(await chosen.arrayBuffer()));
    } catch (err) {
      reportError(err, { feature: "ledger_import", action: "read_file" });
      setText(undefined);
      setReadFailed(true);
    }
  };

  const handleImport = async () => {
    if (!file || rows.length === 0 || isChecking) return;
    setImportFailed(false);
    saveMapping(ledger.id, file.source, mapping);
    const mappedCategories = Object.values(mapping).filter((id) => id !== SKIP).length;
    trackStep("ledger_import", "Import started", {
      source: file.source,
      rows: rows.length,
      alreadyImported: split?.alreadyImported ?? 0,
      duplicatesIncluded: included.size,
      mappedCategories,
      skippedCategories: sources.length - mappedCategories,
    });
    const reached: ImportProgress = { done: 0, total: rows.length };
    try {
      const { created, skippedDuplicates } = await importEntries(
        { ledgerId: ledger.id, source: file.source, rows },
        (next) => {
          Object.assign(reached, next);
          setProgress(next);
        },
      );
      trackStep("ledger_import", "Import finished", { created, skippedDuplicates });
      track("import_entries", { source: file.source, created });
      showToast(
        skippedDuplicates > 0
          ? `Imported ${created} entries. ${skippedDuplicates} were already here.`
          : `Imported ${created} entries.`,
        "success",
      );
      onClose();
    } catch (err) {
      // The first `reached.done` rows were saved; a retry skips them.
      reportError(err, {
        feature: "ledger_import",
        action: "import_entries",
        tags: { source: file.source },
        extra: { done: reached.done, total: reached.total },
      });
      setImportFailed(true);
    }
  };

  const skippedSummary = file
    ? (Object.entries(file.skipped) as Array<[SkipReason, number]>)
        .filter(([, n]) => n > 0)
        .map(([reason, n]) => `${n} ${SKIP_LABELS[reason]}`)
        .join(", ")
    : "";

  return (
    <Modal isOpen onClose={isImporting ? undefined : onClose} className="ImportModal">
      <Modal.Header title="Import">Import</Modal.Header>
      <Modal.Body>
        <p className="ImportModal__hint">
          Bring in spending from a MoneyForward ME or YNAB CSV export. Entries are added as yours;
          importing the same file again skips rows that are already here.
        </p>

        <label className="ImportModal__file">
          <span>{fileName || "choose a .csv file"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={isImporting}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </label>

        {readFailed && <p className="error-message">Couldn't read that file.</p>}
        {parsed && "error" in parsed && parsed.error !== "ambiguous-dates" && (
          <p className="error-message">{ERROR_MESSAGES[parsed.error]}</p>
        )}
        {parsed && "error" in parsed && parsed.error === "ambiguous-dates" && (
          <div className="ImportModal__question">
            <label htmlFor="import-date-order">Which way round are the dates?</label>
            <select
              id="import-date-order"
              value=""
              onChange={(e) => setDateOrder(e.target.value as DateOrder)}
            >
              <option value="" disabled>
                pick one
              </option>
              <option value="DMY">day / month / year</option>
              <option value="MDY">month / day / year</option>
            </select>
          </div>
        )}

        {file && (
          <>
            <p className="ImportModal__summary" role="status">
              {file.rows.length} spending row{file.rows.length === 1 ? "" : "s"} from{" "}
              {SOURCE_LABELS[file.source]}
              {skippedSummary && ` (left out: ${skippedSummary})`}.
            </p>
            {isChecking && (
              <p className="ImportModal__hint" role="status">
                checking which rows are already in this log
                <LoadingDots label="" />
              </p>
            )}
            {split && split.alreadyImported > 0 && (
              <p className="ImportModal__hint">
                {split.alreadyImported} already imported, so{" "}
                {split.alreadyImported === 1 ? "it'll be" : "they'll be"} left out.{" "}
                {split.fresh.length === 0
                  ? "Nothing new in this file."
                  : `${split.fresh.length} new.`}
              </p>
            )}
            {checkResult === "failed" && (
              <p className="ImportModal__hint">
                Couldn't check this log for duplicates. Rows you imported before will still be
                skipped.
              </p>
            )}

            {file.source === "ynab" && (
              <CurrencySelect
                id="import-currency"
                label="Currency of this budget"
                value={currency}
                onChange={setCurrency}
                disabled={isImporting}
              />
            )}

            {check && split && split.flagged.length > 0 && (
              <>
                <h3 className="ImportModal__heading">already logged?</h3>
                <p className="ImportModal__hint">
                  These match an entry in this log on the same day and amount, so they're left out.
                  Tick any that are separate purchases.
                </p>
                <ul className="ImportModal__list" aria-label="Possible duplicates">
                  {split.flagged.map((row) => {
                    const match = check.possibleDuplicates[row.externalId];
                    const on = included.has(row.externalId);
                    return (
                      <li key={row.externalId} className="ImportModal__row">
                        <span className="ImportModal__dupe keep-case">
                          <span>
                            {formatDate(dayjs(row.date), { year: false })} ·{" "}
                            {formatAmount(row.amount, row.currency)}
                            {row.note && ` · ${row.note}`}
                          </span>
                          <small>
                            matches {match.note ? `“${match.note}”` : "an entry"}
                            {match.authorName && ` by ${match.authorName}`}
                          </small>
                        </span>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`Import ${row.note ?? "this row"} on ${row.date} anyway`}
                          className="ImportModal__toggle"
                          disabled={isImporting}
                          onClick={() => toggleIncluded(row.externalId)}
                        >
                          <span aria-hidden="true">{on ? "[■]" : "[ ]"}</span> import
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {sources.length > 0 && (
              <>
                <h3 className="ImportModal__heading">categories</h3>
                <ul className="ImportModal__list" aria-label="Category mapping">
                  {sources.map(({ name, count }) => (
                    <li key={name} className="ImportModal__row">
                      <span className="ImportModal__name keep-case">
                        {name} <small>({count})</small>
                      </span>
                      <select
                        aria-label={`Ledger category for ${name}`}
                        value={mapping[name] ?? SKIP}
                        disabled={isImporting}
                        onChange={(e) => setPicked((p) => ({ ...p, [name]: e.target.value }))}
                      >
                        <option value={SKIP}>— skip —</option>
                        {active.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {months.length > 0 && (
              <>
                <h3 className="ImportModal__heading">preview</h3>
                <ul className="ImportModal__list" aria-label="Preview by month">
                  {months.map(({ month, count, totals }) => (
                    <li key={month} className="ImportModal__row">
                      <span>{formatMonth(month)}</span>
                      <span className="keep-case">
                        {count} · {formatTotals(totals)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {skippedByMapping > 0 && (
              <p className="ImportModal__hint">
                {skippedByMapping} row{skippedByMapping === 1 ? "" : "s"} in skipped categories
                won't be imported.
              </p>
            )}
          </>
        )}

        {isImporting && progress && (
          <p className="ImportModal__progress" role="status">
            importing {progress.done} / {progress.total}
            <LoadingDots label="" />
          </p>
        )}
        {importFailed && (
          <p className="error-message">
            The import stopped partway. Try again: rows already imported will be skipped.
          </p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button text="Cancel" variant="secondary" disabled={isImporting} onClick={onClose} />
        <Button
          text={rows.length > 0 ? `Import ${rows.length}` : "Import"}
          variant="primary"
          disabled={rows.length === 0 || isImporting || isChecking}
          loading={isImporting}
          onClick={() => void handleImport()}
        />
      </Modal.Actions>
    </Modal>
  );
};

export default ImportModal;
