import type { Ledger } from "@/types/ledger";
import { formatMonth } from "@/utils/ledger";
import { IconText } from "@/components/Icon";
import RowButton from "@/components/RowButton";
import { EntryForm } from "@/features/ledger/components/EntryForm";
import { EntryList } from "@/features/ledger/components/EntryList";
import { LedgerStatsStrip } from "@/features/ledger/components/LedgerStats";
import { FACES } from "@/features/ledger/buddy/faces";

import {
  SAMPLE_LEDGER,
  SAMPLE_LEDGER_CURRENCY,
  SAMPLE_LEDGER_ENTRIES,
  SAMPLE_LEDGER_MONTH,
  SAMPLE_LEDGER_TODAY,
} from "./landingSamples";

import "@/features/ledger/components/Ledger.scss";
import "@/features/ledger/buddy/BudgetBuddy.scss";

const ledger = SAMPLE_LEDGER as Ledger;
const nothing = async () => undefined;
// The month's totals count every entry, but the list stops after the latest three days,
// like a screen you'd scroll, so the picture stays a sensible height on phones.
const SHOWN_DAYS = new Set(
  [...new Set(SAMPLE_LEDGER_ENTRIES.map((e) => e.date))].sort().reverse().slice(0, 3),
);
const SHOWN_ENTRIES = SAMPLE_LEDGER_ENTRIES.filter((e) => SHOWN_DAYS.has(e.date));

/**
 * A personal financial log as it looks in use, for the landing page: the real header, month
 * bar, budget strip, add form and entry list, filled with the sample month. It's a picture,
 * so the whole thing is inert: nothing in it can be clicked, focused or typed into.
 */
export const LedgerPreview = () => (
  <div
    className="Landing__ledger"
    ref={(el) => {
      // React 18 doesn't know the inert attribute, so it's set on the element.
      if (el) el.inert = true;
    }}
  >
    <div className="Group Ledger">
      <div className="Group__header">
        <div className="Group__header__left">
          <div className="Group__header__item">financial</div>
        </div>
        <div className="Group__header__center">
          <div className="Group__header__item Group__header__title">{ledger.title}</div>
        </div>
        <div className="Group__header__right">
          <div className="Group__header__item Group__header__item--iconOnly">
            <IconText type="gear" fill="white" text="manage" />
          </div>
          <div className="Group__header__item Group__header__item--iconOnly">
            <IconText type="pencil" fill="white" text="categories" />
          </div>
          <div className="Group__header__item Group__header__item--iconOnly">
            <IconText type="document" fill="white" text="import" />
          </div>
        </div>
      </div>

      <div className="Ledger__body">
        <nav className="Ledger__month" aria-label="Month">
          <div className="Ledger__month__controls">
            <RowButton glyph aria-label="Previous month">
              ‹
            </RowButton>
            <strong className="Ledger__month__label">{formatMonth(SAMPLE_LEDGER_MONTH)}</strong>
            <RowButton glyph aria-label="Next month">
              ›
            </RowButton>
          </div>
          <div className="Ledger__month__buddy">
            <span className="BudgetBuddy BudgetBuddy--happy keep-case">
              {FACES.happy.resting[0]}
            </span>
          </div>
        </nav>

        <LedgerStatsStrip
          ledger={ledger}
          month={SAMPLE_LEDGER_MONTH}
          today={SAMPLE_LEDGER_TODAY}
          entries={SAMPLE_LEDGER_ENTRIES}
          isLoading={false}
          onEditBudget={() => undefined}
        />

        <EntryForm
          mode="add"
          categories={ledger.categories}
          isSaving={false}
          initial={{
            amount: "",
            currency: SAMPLE_LEDGER_CURRENCY,
            categoryId: "food",
            date: SAMPLE_LEDGER_TODAY,
            note: "",
          }}
          onSubmit={nothing}
        />

        <EntryList
          entries={SHOWN_ENTRIES}
          categories={ledger.categories}
          showAuthors={false}
          isSavingEdit={false}
          isDeleting={false}
          onEdit={nothing}
          onDelete={nothing}
        />
      </div>
    </div>
  </div>
);

export default LedgerPreview;
