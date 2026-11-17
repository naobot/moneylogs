import { useMemo, useState } from "react";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import CurrencySelect from "@/components/CurrencySelect";
import { useToastContext } from "@/hooks/useToastContext";
import { Ledger } from "@/types/ledger";
import { Currency } from "@/types/user";
import { activeCategories, formatMonth } from "@/utils/ledger";
import { formatTotals } from "@/utils/ledgerEntries";
import { reportError } from "@/utils/reportError";
import { DateOrder } from "./dates";
import { ImportErrorCode, ImportFormatError } from "./errors";
import { ImportProgress, importEntries } from "./importEntries";
import { ParsedImportFile, parseImportFile } from "./parseImportFile";
import {
  CategoryMapping,
  SKIP,
  initialMapping,
  mapRows,
  previewByMonth,
  readSavedMapping,
  saveMapping,
  sourceCategories,
} from "./plan";
import { decodeBytes } from "./text";
import { ImportSource, SkipReason } from "./types";

import "./ImportModal.scss";

const SOURCE_LABELS: Record<ImportSource, string> = {
  moneyforward: "MoneyForward ME",
  ynab: "YNAB",
};

const ERROR_MESSAGES: Record<Exclude<ImportErrorCode, "ambiguous-dates">, string> = {
  empty: "That file has no rows to import.",
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

type Parsed = { file: ParsedImportFile } | { error: ImportErrorCode };

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

  const categories = useMemo(() => ledger.categories ?? [], [ledger.categories]);
  const active = activeCategories(categories);
  const isImporting = progress !== undefined && !importFailed;

  const parsed = useMemo<Parsed | undefined>(() => {
    if (text === undefined) return undefined;
    try {
      return { file: parseImportFile(text, { currency, dateOrder }) };
    } catch (err) {
      if (err instanceof ImportFormatError) return { error: err.code };
      throw err;
    }
  }, [text, currency, dateOrder]);

  const file = parsed && "file" in parsed ? parsed.file : undefined;
  const sources = useMemo(() => (file ? sourceCategories(file.rows) : []), [file]);
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
  const rows = useMemo(() => (file ? mapRows(file.rows, mapping) : []), [file, mapping]);
  const months = useMemo(() => previewByMonth(rows), [rows]);
  const skippedByMapping = (file?.rows.length ?? 0) - rows.length;

  const handleFile = async (chosen: File | undefined) => {
    setReadFailed(false);
    setPicked({});
    setDateOrder(undefined);
    if (!chosen) {
      setText(undefined);
      return;
    }
    setFileName(chosen.name);
    try {
      setText(decodeBytes(await chosen.arrayBuffer()));
    } catch (err) {
      reportError(err, { feature: "ledger", action: "import_read_file" });
      setText(undefined);
      setReadFailed(true);
    }
  };

  const handleImport = async () => {
    if (!file || rows.length === 0) return;
    setImportFailed(false);
    saveMapping(ledger.id, file.source, mapping);
    try {
      const { created, skippedDuplicates } = await importEntries(
        { ledgerId: ledger.id, source: file.source, rows },
        setProgress,
      );
      showToast(
        skippedDuplicates > 0
          ? `Imported ${created} entries. ${skippedDuplicates} were already here.`
          : `Imported ${created} entries.`,
        "success",
      );
      onClose();
    } catch (err) {
      reportError(err, {
        feature: "ledger",
        action: "import_entries",
        extra: { source: file.source, rowCount: rows.length },
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
      <Modal.Header striped title="Import">
        Import
      </Modal.Header>
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

            {file.source === "ynab" && (
              <CurrencySelect
                id="import-currency"
                label="Currency of this budget"
                value={currency}
                onChange={setCurrency}
                disabled={isImporting}
              />
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
            importing {progress.done} / {progress.total}…
          </p>
        )}
        {importFailed && (
          <p className="error-message">
            The import stopped partway. Try again: rows already imported will be skipped.
          </p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button
          text={rows.length > 0 ? `Import ${rows.length}` : "Import"}
          buttonStyle="primary-border"
          disabled={rows.length === 0 || isImporting}
          loading={isImporting}
          onClick={() => void handleImport()}
        />
        <Button
          text="Cancel"
          buttonStyle="primary-border-lite"
          disabled={isImporting}
          onClick={onClose}
        />
      </Modal.Actions>
    </Modal>
  );
};

export default ImportModal;
