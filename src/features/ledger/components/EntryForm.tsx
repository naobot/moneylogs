import { FormEvent, useEffect, useRef, useState } from "react";
import cx from "classnames";

import { Currency } from "@/types/user";
import { LedgerCategory, LedgerEntryInput } from "@/types/ledger";
import type { EntryFormValues } from "@/utils/ledgerEntries";
import { CURRENCIES } from "@/utils/currency";
import { activeCategories, MAX_NOTE_LENGTH, resolveCategory, validateEntry } from "@/utils/ledger";
import { toEntryInput } from "@/utils/ledgerEntries";

import Button from "@/components/Button";
import { useLedgerTour } from "@/features/ledger/tour/LedgerTour";
import type { LedgerTourTarget } from "@/features/ledger/tour/tourRules";

export type { EntryFormValues } from "@/utils/ledgerEntries";

type EntryFormProps = {
  mode: "add" | "edit";
  categories: ReadonlyArray<LedgerCategory>;
  initial: EntryFormValues;
  isSaving: boolean;
  onSubmit: (input: LedgerEntryInput) => Promise<unknown>;
  onCancel?: () => void;
};

/**
 * Compact, keyboard-first form for one entry. In "add" mode, a successful save clears the
 * amount and note but keeps currency/category/date, and refocuses the amount, so a run of
 * purchases can be logged quickly.
 */
export const EntryForm = ({
  mode,
  categories,
  initial,
  isSaving,
  onSubmit,
  onCancel,
}: EntryFormProps) => {
  const [values, setValues] = useState<EntryFormValues>(initial);
  const [failed, setFailed] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const tour = useLedgerTour();
  // The first-run tour only walks through the add form.
  const tip = (target: LedgerTourTarget) => (mode === "add" ? tour.tip(target) : null);
  const anchor = (className: string, ...targets: LedgerTourTarget[]) =>
    cx(className, {
      TourAnchor: mode === "add" && targets.some((t) => t === tour.activeTarget),
    });

  // A different default date (e.g. after switching month) resets the add form's date.
  useEffect(() => {
    if (mode === "add") setValues((v) => ({ ...v, date: initial.date }));
  }, [initial.date, mode]);

  // If the selected category is archived or deleted while adding, fall back to the first
  // active one (the ledger's categories update live).
  useEffect(() => {
    if (mode !== "add") return;
    const active = activeCategories(categories);
    if (active.length > 0 && !active.some((c) => c.id === values.categoryId)) {
      setValues((v) => ({ ...v, categoryId: active[0].id }));
    }
  }, [categories, mode, values.categoryId]);

  const set = (patch: Partial<EntryFormValues>) => {
    setFailed(false);
    setValues((v) => ({ ...v, ...patch }));
  };

  const input = toEntryInput(values);
  const errors = validateEntry(input, categories);
  // Adds clear instantly, so let the next one go while the previous write is in flight;
  // edits wait for their save.
  const canSave = errors.length === 0 && (mode === "add" || !isSaving);
  const amountTouched = values.amount.trim() !== "";

  // Editing an entry in an archived category keeps it selectable for that entry.
  const options = activeCategories(categories);
  if (values.categoryId && !options.some((c) => c.id === values.categoryId)) {
    options.push(resolveCategory(values.categoryId, categories));
  }

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave) return;
    // In add mode, clear right away rather than after the server acknowledges the write
    // (the new row already shows from Firestore's local snapshot), and restore on failure.
    const submitted = values;
    if (mode === "add") {
      setValues((v) => ({ ...v, amount: "", note: "" }));
      amountRef.current?.focus();
    }
    try {
      await onSubmit(input);
    } catch (err) {
      console.error("Failed to save entry:", err);
      if (mode === "add") setValues(submitted);
      setFailed(true);
    }
  };

  return (
    <form
      className={cx("EntryForm", `EntryForm--${mode}`)}
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel) onCancel();
      }}
      noValidate
    >
      {/* Mirrors the social post editor: a compact, label-less header row
          (date · amount + currency · category), then the note and a small button. */}
      <div className="EntryForm__header">
        <div className={anchor("EntryForm__header__left", "date")}>
          {tip("date")}
          <input
            type="date"
            aria-label="Date"
            value={values.date}
            aria-invalid={errors.includes("date")}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
        <div className={anchor("EntryForm__header__center", "amount", "currency")}>
          {tip("amount")}
          {tip("currency")}
          <input
            ref={amountRef}
            className="LogPostsCurrency__input EntryForm__amount"
            aria-label="Amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={values.amount}
            aria-invalid={amountTouched && errors.includes("amount")}
            onChange={(e) => set({ amount: e.target.value })}
            autoFocus={mode === "edit"}
          />
          <select
            aria-label="Currency"
            value={values.currency}
            onChange={(e) => set({ currency: e.target.value as Currency })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className={anchor("EntryForm__header__right", "category")}>
          {tip("category")}
          <select
            aria-label="Category"
            value={values.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
          >
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
          {onCancel && (
            <Button
              buttonStyle="primary-border-lite"
              size="sm"
              text={"×"}
              title="Close"
              onClick={onCancel}
            />
          )}
        </div>
      </div>
      <div className={anchor("EntryForm__body", "note")}>
        {tip("note")}
        <label className="EntryForm__noteField">
          <span className="EntryForm__noteLabel">Note:</span>
          <input
            className="LineInput EntryForm__note"
            maxLength={MAX_NOTE_LENGTH}
            placeholder="Example: coffee, new shoes, etc."
            value={values.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </label>
        <Button
          text={mode === "add" ? "Add" : "Save"}
          buttonStyle="primary-border"
          size="sm"
          disabled={!canSave}
          loading={mode === "edit" && isSaving}
          onClick={() => void handleSubmit()}
        />
      </div>
      {/* Enter in any field submits via the form's implicit submission. */}
      <button type="submit" className="EntryForm__submit" tabIndex={-1} aria-hidden="true" />
      {failed && <p className="EntryForm__error">Couldn't save that entry. Please try again.</p>}
    </form>
  );
};

export default EntryForm;
