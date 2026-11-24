import { FormEvent, useState } from "react";

import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useLedgerScheduleQuery } from "@/hooks/useLedgerScheduleQuery";
import { profileName, useProfiles } from "@/hooks/useProfiles";
import { LedgerCategory, LedgerSchedule } from "@/types/ledger";
import { Currency } from "@/types/user";
import { track } from "@/utils/analytics";
import { CURRENCIES } from "@/utils/currency";
import { todayInTz } from "@/utils/ledger";
import { formatAmount } from "@/utils/ledgerEntries";
import { reportError } from "@/utils/reportError";
import {
  dayChoices,
  describeRepeat,
  emptyScheduleForm,
  formatDueDay,
  MAX_SCHEDULE_LABEL_LENGTH,
  MAX_SCHEDULES_PER_CATEGORY,
  MONTH_NAMES,
  ordinal,
  ScheduleFormValues,
  scheduleFormError,
  scheduleFormOf,
  ScheduleInput,
  switchRepeat,
  toScheduleInput,
  withDay,
  withMonth,
} from "@/utils/schedules";

export const SCHEDULE_HELP =
  "Scheduled payments are logged for you on the day, around 8am your time, and you'll get a notification so you can fix the amount if it changed. A day past a month's end falls on its last day.";

type ScheduledPaymentsProps = {
  ledgerId: string;
  category: LedgerCategory;
  /** This ledger's schedules in this category. */
  schedules: ReadonlyArray<LedgerSchedule>;
  /** What a new one starts in. */
  defaultCurrency: Currency;
};

/**
 * A fixed category's scheduled payments: a line each (what, how much, when, next due),
 * and a form to add one. Only whoever set one up can change it, since its entries are
 * logged as theirs; others in a shared log see who did.
 */
export const ScheduledPayments = ({
  ledgerId,
  category,
  schedules,
  defaultCurrency,
}: ScheduledPaymentsProps) => {
  const { user } = useCurrentUser();
  const { addSchedule, updateSchedule, deleteSchedule } = useLedgerScheduleQuery();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const others = schedules.filter((s) => s.ownerUid !== user?.userId).map((s) => s.ownerDocId);
  const profiles = useProfiles(others);
  const thisYear = todayInTz(user?.timezone).slice(0, 4);

  const run = async (action: string, fn: () => Promise<unknown>) => {
    setFailed(false);
    try {
      await fn();
      return true;
    } catch (err) {
      reportError(err, { feature: "ledger", action });
      setFailed(true);
      return false;
    }
  };

  const add = async (input: ScheduleInput) => {
    if (!user) return false;
    const ok = await run("add_schedule", () =>
      addSchedule.mutate({
        ledgerId,
        input,
        owner: { uid: user.userId, userDocId: user.id },
      }),
    );
    if (ok) {
      track("schedule_payment", { action: "create", repeat: input.repeat.every });
      setAdding(false);
    }
    return ok;
  };

  const change = (s: LedgerSchedule, values: ScheduleFormValues) => {
    const input = toScheduleInput(category.id, values) as ScheduleInput;
    const same =
      input.label === s.label &&
      input.amount === s.amount &&
      input.currency === s.currency &&
      JSON.stringify(input.repeat) === JSON.stringify(s.repeat);
    if (same) return;
    void run("update_schedule", () =>
      updateSchedule.mutate({
        ledgerId,
        scheduleId: s.id,
        changes: {
          label: input.label,
          amount: input.amount,
          currency: input.currency,
          repeat: input.repeat,
        },
      }),
    );
  };

  const togglePaused = (s: LedgerSchedule) => {
    const paused = !s.paused;
    void run("pause_schedule", async () => {
      await updateSchedule.mutate({ ledgerId, scheduleId: s.id, changes: { paused } });
      track("schedule_payment", { action: paused ? "pause" : "resume", repeat: s.repeat.every });
    });
  };

  const remove = (s: LedgerSchedule) => {
    if (editingId === s.id) setEditingId(null);
    void run("delete_schedule", async () => {
      await deleteSchedule.mutate({ ledgerId, scheduleId: s.id });
      track("schedule_payment", { action: "delete", repeat: s.repeat.every });
    });
  };

  const full = schedules.length >= MAX_SCHEDULES_PER_CATEGORY;

  return (
    <section className="CategoryDetail__section ScheduledPayments">
      <div className="CategoryDetail__field">
        <span className="CategoryDetail__label">scheduled payments</span>
      </div>

      {schedules.length > 0 && (
        <ul className="ScheduledPayments__list" aria-label={`${category.name} scheduled payments`}>
          {schedules.map((s) => {
            const mine = s.ownerUid === user?.userId;
            if (mine && editingId === s.id) {
              return (
                <li key={s.id} className="ScheduledPayments__item">
                  <ScheduleForm
                    categoryId={category.id}
                    initial={scheduleFormOf(s)}
                    onCommit={(values) => change(s, values)}
                    onDone={() => setEditingId(null)}
                  />
                </li>
              );
            }
            const setUpBy = mine ? undefined : profileName(profiles, s.ownerDocId);
            return (
              <li
                key={s.id}
                className={`ScheduledPayments__item${s.paused ? " ScheduledPayments__item--paused" : ""}`}
              >
                <span className="ScheduledPayments__what">
                  <span className="keep-case">{s.label}</span>
                  <span className="keep-case">{formatAmount(s.amount, s.currency)}</span>
                </span>
                <span className="ScheduledPayments__when">
                  {describeRepeat(s.repeat)}
                  {" · "}
                  {s.paused
                    ? "paused"
                    : s.nextDue
                      ? `next ${formatDueDay(s.nextDue, thisYear)}`
                      : "booking…"}
                </span>
                {mine ? (
                  <span className="ScheduledPayments__actions">
                    <RowButton aria-label={`Edit ${s.label}`} onClick={() => setEditingId(s.id)}>
                      edit
                    </RowButton>
                    <RowButton
                      aria-label={`${s.paused ? "Resume" : "Pause"} ${s.label}`}
                      onClick={() => togglePaused(s)}
                    >
                      {s.paused ? "resume" : "pause"}
                    </RowButton>
                    <RowButton aria-label={`Remove ${s.label}`} onClick={() => remove(s)}>
                      remove
                    </RowButton>
                  </span>
                ) : (
                  <small className="ScheduledPayments__owner">
                    set up by <span className="keep-case">{setUpBy ?? "…"}</span>
                  </small>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="ScheduledPayments__item">
          <ScheduleForm
            categoryId={category.id}
            initial={emptyScheduleForm(defaultCurrency)}
            onSubmit={add}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        !full && (
          <button
            type="button"
            className="CategoryDetail__drawerToggle"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
          >
            [+ scheduled payment]
          </button>
        )
      )}

      {failed && <p className="error-message">Couldn't save that change. Please try again.</p>}
      <p className="CategoryDetail__help">{SCHEDULE_HELP}</p>
    </section>
  );
};

type ScheduleFormProps = {
  categoryId: string;
  initial: ScheduleFormValues;
  onDone: () => void;
} & (
  | {
      /** A new one: saved by [add] (or Enter) once it's complete. */
      onSubmit: (input: ScheduleInput) => Promise<boolean>;
      onCommit?: never;
    }
  | {
      /** An existing one: each change saves as it's made (on leaving a field). */
      onCommit: (values: ScheduleFormValues) => void;
      onSubmit?: never;
    }
);

/** Name, amount + currency, and when: monthly on a day, or yearly on a date. */
const ScheduleForm = ({ categoryId, initial, onSubmit, onCommit, onDone }: ScheduleFormProps) => {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const error = scheduleFormError(categoryId, values);
  const isNew = !!onSubmit;

  const set = (next: ScheduleFormValues, commitNow = false) => {
    setValues(next);
    if (commitNow && onCommit && !scheduleFormError(categoryId, next)) onCommit(next);
  };
  const commit = () => {
    if (onCommit && !error) onCommit(values);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!onSubmit) {
      commit();
      onDone();
      return;
    }
    if (error || saving) return;
    setSaving(true);
    const ok = await onSubmit(toScheduleInput(categoryId, values) as ScheduleInput);
    if (!ok) setSaving(false);
  };

  const { repeat } = values;
  return (
    <form className="ScheduledPayments__form" onSubmit={submit}>
      <span className="ScheduledPayments__row">
        <input
          className="LineInput keep-case ScheduledPayments__label"
          aria-label="Payment name"
          placeholder="name, e.g. rent"
          maxLength={MAX_SCHEDULE_LABEL_LENGTH}
          value={values.label}
          onChange={(e) => set({ ...values, label: e.target.value })}
          onBlur={commit}
          autoFocus={isNew}
        />
        <span className="ScheduledPayments__amount">
          <input
            className="LineInput ScheduledPayments__amountInput"
            aria-label="Payment amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="amount"
            value={values.amount}
            onChange={(e) => set({ ...values, amount: e.target.value })}
            onBlur={commit}
          />
          <select
            aria-label="Payment currency"
            value={values.currency}
            onChange={(e) => set({ ...values, currency: e.target.value as Currency }, true)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </span>
      </span>
      <span className="ScheduledPayments__row">
        <select
          aria-label="Repeats"
          value={repeat.every}
          onChange={(e) =>
            set(
              { ...values, repeat: switchRepeat(repeat, e.target.value as "month" | "year") },
              true,
            )
          }
        >
          <option value="month">monthly</option>
          <option value="year">yearly</option>
        </select>
        <span className="ScheduledPayments__on">
          on
          {repeat.every === "year" && (
            <select
              aria-label="Month"
              value={repeat.month}
              onChange={(e) =>
                set({ ...values, repeat: withMonth(repeat, Number(e.target.value)) }, true)
              }
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Day"
            value={repeat.day}
            onChange={(e) =>
              set({ ...values, repeat: withDay(repeat, Number(e.target.value)) }, true)
            }
          >
            {dayChoices(repeat).map((d) => (
              <option key={d} value={d}>
                {repeat.every === "month" ? ordinal(d) : d}
              </option>
            ))}
          </select>
        </span>
        <span className="ScheduledPayments__actions">
          {isNew ? (
            <>
              <RowButton onClick={onDone}>cancel</RowButton>
              <RowButton type="submit" disabled={saving}>
                add
              </RowButton>
            </>
          ) : (
            <RowButton type="submit">done</RowButton>
          )}
        </span>
      </span>
      {touched && error && <small className="CategoryManager__error">{error}</small>}
    </form>
  );
};

export default ScheduledPayments;
