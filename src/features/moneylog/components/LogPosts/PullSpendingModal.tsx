import { useMemo, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import cx from "classnames";
import dayjs from "@/utils/configuredDayjs";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import { Ledger, CurrencyAmounts } from "@/types/ledger";
import { useMyEntriesOnDay } from "@/hooks/useMyEntriesOnDay";
import { formatDate } from "@/utils/dateFormat";
import { formatAmount, formatTotals } from "@/utils/ledgerEntries";
import {
  buildPulledMarkdown,
  initialSelection,
  logSelection,
  LogSelection,
  selectedIds,
  selectedTotals,
  toggleEntry,
  toggleLog,
} from "@/utils/pullLines";
import "./PullSpendingModal.scss";

export type PulledSpending = {
  markdown: string;
  totals: CurrencyAmounts;
  entryIds: string[];
  ledgerCount: number;
};

const BOX: Record<LogSelection, string> = { all: "[■]", some: "[-]", none: "[ ]" };

/**
 * Pick which of your own financial-log entries on the post's day to copy into it.
 * Grouped by log, with a checkbox per log and per entry; entries already pulled into
 * one of your posts start unticked and are marked.
 */
const PullSpendingModal = ({
  ledgers,
  uid,
  authorDocId,
  groupId,
  day: initialDay,
  alreadyPulled,
  onClose,
  onAdd,
}: {
  ledgers: ReadonlyArray<Ledger>;
  /** The author's auth uid. */
  uid: string;
  /** The author's users-collection doc id. */
  authorDocId: string | undefined;
  groupId: string;
  /** The post's day, YYYY-MM-DD. */
  day: string;
  alreadyPulled: ReadonlySet<string>;
  onClose: () => void;
  onAdd: (pulled: PulledSpending) => void;
}) => {
  // Catching up on yesterday is common, so the day can be stepped.
  const [day, setDay] = useState(initialDay);
  // The logs as they were when the picker opened: a later snapshot of the same logs
  // shouldn't refetch and reset what's ticked.
  const [ledgersAtOpen] = useState(ledgers);
  const { groups, pulled, isLoading, isError } = useMyEntriesOnDay({
    ledgers: ledgersAtOpen,
    uid,
    day,
    groupId,
    authorDocId,
    enabled: true,
  });
  // Saved posts the hook found (loaded on the page or not), plus this draft's own pulls.
  const marked = useMemo(() => new Set([...alreadyPulled, ...pulled]), [alreadyPulled, pulled]);

  // Each newly loaded day starts with everything ticked except what's already pulled.
  const [selectionFor, setSelectionFor] = useState(groups);
  const [selected, setSelected] = useState(() => initialSelection(groups, marked));
  if (selectionFor !== groups) {
    setSelectionFor(groups);
    setSelected(initialSelection(groups, marked));
  }

  const totals = useMemo(() => selectedTotals(groups, selected), [groups, selected]);
  const ids = useMemo(() => selectedIds(groups, selected), [groups, selected]);

  const stepDay = (by: number) => setDay((d) => dayjs(d).add(by, "day").format("YYYY-MM-DD"));

  const handleAdd = () => {
    onAdd({
      markdown: buildPulledMarkdown(groups, selected),
      totals,
      entryIds: ids,
      ledgerCount: groups.filter((g) => logSelection(g, selected) !== "none").length,
    });
    onClose();
  };

  const dayLabel = formatDate(dayjs(day), { year: false });

  return (
    <Modal isOpen onClose={onClose} className="PullSpendingModal">
      <Modal.Header title="pull spending">pull spending</Modal.Header>
      <Modal.Body>
        <div className="PullSpendingModal__day">
          <RowButton
            glyph
            aria-label="previous day"
            title="previous day"
            onClick={() => stepDay(-1)}
          >
            ‹
          </RowButton>
          <span>{dayLabel}</span>
          <RowButton glyph aria-label="next day" title="next day" onClick={() => stepDay(1)}>
            ›
          </RowButton>
        </div>
        <p className="PullSpendingModal__hint">
          Your own entries from your financial logs on this day. They're copied into the post as
          text you can edit, and added to its amounts.
        </p>

        {isLoading ? (
          <p className="PullSpendingModal__hint" role="status">
            loading
            <LoadingDots label="" />
          </p>
        ) : isError ? (
          <p className="error-message">Couldn't load your financial logs. Please try again.</p>
        ) : groups.length === 0 ? (
          <p className="PullSpendingModal__empty">nothing logged in your logs on this day</p>
        ) : (
          groups.map((group) => {
            const state = logSelection(group, selected);
            return (
              <section key={group.ledgerId} className="PullSpendingModal__log">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
                  className="PullSpendingModal__toggle PullSpendingModal__logToggle keep-case"
                  onClick={() => setSelected((s) => toggleLog(group, s))}
                >
                  <span aria-hidden="true">{BOX[state]}</span> {group.title}
                </button>
                <ul className="PullSpendingModal__list">
                  {group.entries.map((entry) => {
                    const on = selected.has(entry.id);
                    const isPulled = marked.has(entry.id);
                    const name = entry.note
                      ? `${entry.note} · ${entry.categoryName}`
                      : entry.categoryName;
                    return (
                      <li
                        key={entry.id}
                        className={cx("PullSpendingModal__row", {
                          "PullSpendingModal__row--pulled": isPulled,
                        })}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          className="PullSpendingModal__toggle keep-case"
                          onClick={() => setSelected((s) => toggleEntry(entry.id, s))}
                        >
                          <span aria-hidden="true">{on ? "[■]" : "[ ]"}</span> {name}
                          {isPulled && <small> · already in a post</small>}
                        </button>
                        <span className="PullSpendingModal__amount">
                          {formatAmount(entry.amount, entry.currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {ids.length > 0 && (
          <p className="PullSpendingModal__total">
            {ids.length} {ids.length === 1 ? "entry" : "entries"} · {formatTotals(totals)}
          </p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button text="Cancel" variant="secondary" onClick={onClose} />
        <Button
          text="Add to post"
          variant="primary"
          disabled={ids.length === 0}
          onClick={handleAdd}
        />
      </Modal.Actions>
    </Modal>
  );
};

export default PullSpendingModal;
