import { ReactNode, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useLedgerCategoryQuery } from "@/hooks/useLedgerCategoryQuery";
import { Ledger } from "@/types/ledger";
import ShareLinkButton from "@/features/layout/components/ShareLinkButton";
import {
  formatMonth,
  isValidMonthKey,
  ledgerViewPath,
  LedgerView,
  monthKeyOf,
  shiftMonth,
  spotsLeft,
  todayInTz,
} from "@/utils/ledger";
import CopyTextArea from "@/features/layout/components/CopyTextArea";
import { IconText } from "@/components/Icon";
import Modal from "@/components/Modal";
import CategoryManager from "./CategoryManager";
import BudgetManager from "./BudgetManager";
import ImportModal from "@/features/ledger/import/ImportModal";
import LogActionsModal from "@/features/logActions/LogActionsModal";
import LedgerCurrencySection from "./LedgerCurrencySection";
import { creatorUid } from "@/utils/logOwnership";
import { shareUrl } from "@/utils/shareUrl";
import InviteFriends from "@/features/invites/FriendPicker";
import { BudgetBuddy } from "@/features/ledger/buddy/BudgetBuddy";
import { LedgerTourProvider, useLedgerTour } from "@/features/ledger/tour/LedgerTour";

import "./Ledger.scss";

export type LedgerShellContext = {
  month: string;
  today: string;
  setMonth: (month: string) => void;
  /** Opens the monthly budgets editor. */
  openBudgets: () => void;
};

type LedgerShellProps = {
  ledger: Ledger;
  view: LedgerView;
  children: (ctx: LedgerShellContext) => ReactNode;
};

/**
 * Shared frame for a ledger's pages: header (title, categories, invite) and the month
 * switcher with a link between the entries and stats views. The viewed month lives in
 * ?month= so refresh, back and switching views keep your place.
 */
export const LedgerShell = (props: LedgerShellProps) => (
  // The first-run tour points at the add form, so it only runs on the entries view.
  <LedgerTourProvider ledger={props.ledger} enabled={props.view === "entries"}>
    <LedgerShellFrame {...props} />
  </LedgerTourProvider>
);

const LedgerShellFrame = ({ ledger, view, children }: LedgerShellProps) => {
  const { user } = useCurrentUser();
  const { tip } = useLedgerTour();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { saveCategoryOps, isCategoryUsed } = useLedgerCategoryQuery();

  const spots = spotsLeft(ledger);
  const isShared = (ledger.memberUids?.length ?? 0) > 1;

  const today = todayInTz(user?.timezone);
  const currentMonth = monthKeyOf(today);
  const requestedMonth = searchParams.get("month") ?? "";
  const month = isValidMonthKey(requestedMonth) ? requestedMonth : currentMonth;
  const setMonth = (next: string) => setSearchParams(next === currentMonth ? {} : { month: next });

  const otherView: LedgerView = view === "entries" ? "stats" : "entries";

  return (
    <>
      <div className="Group Ledger">
        <div className="Group__header">
          <div className="Group__header__left">
            <div className="Group__header__item">
              {isShared ? `financial · ${ledger.memberUids.length} members` : "financial"}
            </div>
          </div>
          <div className="Group__header__center">
            <div className="Group__header__item Group__header__title">{ledger.title}</div>
          </div>
          <div className="Group__header__right">
            <div
              className="handler Group__header__item Group__header__item--iconOnly"
              title="Manage"
              onClick={() => setShowManageModal(true)}
            >
              <IconText type={"gear"} fill={"white"} text="manage" />
            </div>
            <div
              className="handler Group__header__item Group__header__item--iconOnly"
              title="Categories"
              onClick={() => setShowCategories(true)}
            >
              <IconText type={"pencil"} fill={"white"} text="categories" />
              {tip("categories")}
            </div>
            {view === "entries" && (
              <div
                className="handler Group__header__item Group__header__item--iconOnly"
                title="Import"
                onClick={() => setShowImport(true)}
              >
                <IconText type={"document"} fill={"white"} text="import" />
              </div>
            )}
            {spots > 0 && (
              <>
                <div
                  className="handler Group__header__item"
                  onClick={() => setShowInviteModal(true)}
                >
                  <IconText type={"plus"} fill={"white"} text="invite" />
                </div>
                <div className="Group__header__item">
                  <small>
                    ({spots} spot{spots > 1 && "s"} left)
                  </small>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="Ledger__body">
          <nav className="Ledger__month" aria-label="Month">
            <div className="Ledger__month__controls">
              {tip("month", ".Ledger__month__label")}
              <RowButton
                glyph
                aria-label="Previous month"
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                ‹
              </RowButton>
              <strong className="Ledger__month__label">{formatMonth(month)}</strong>
              <RowButton
                glyph
                aria-label="Next month"
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                ›
              </RowButton>
              {month !== currentMonth && (
                <RowButton onClick={() => setMonth(currentMonth)}>this month</RowButton>
              )}
            </div>
            {/* Always about this month, whichever month is being browsed. */}
            <div className="Ledger__month__buddy">
              {tip("buddy")}
              <BudgetBuddy ledger={ledger} />
            </div>
            <Link
              className="Ledger__month__view"
              to={ledgerViewPath(ledger.id, otherView, month, currentMonth)}
            >
              {otherView === "stats" ? "stats ›" : "‹ entries"}
              {tip("stats")}
            </Link>
          </nav>

          {children({ month, today, setMonth, openBudgets: () => setShowBudgets(true) })}
        </div>
      </div>
      <LogActionsModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        logId={ledger.id}
        logTitle={ledger.title}
        kind="financial"
        creatorUid={creatorUid(ledger, "financial")}
        settings={<LedgerCurrencySection ledger={ledger} />}
      />
      <CategoryManager
        isOpen={showCategories}
        categories={ledger.categories ?? []}
        defaultCurrency={ledger.defaultCurrency}
        onClose={() => setShowCategories(false)}
        onSave={(ops) => saveCategoryOps.mutate({ ledgerId: ledger.id, ops })}
        checkInUse={(categoryId) => isCategoryUsed.mutate({ ledgerId: ledger.id, categoryId })}
      />
      <BudgetManager
        isOpen={showBudgets}
        categories={ledger.categories ?? []}
        defaultCurrency={ledger.defaultCurrency}
        onClose={() => setShowBudgets(false)}
        isSaving={saveCategoryOps.isLoading}
        onSave={(ops) => saveCategoryOps.mutate({ ledgerId: ledger.id, ops })}
      />
      <ImportModal isOpen={showImport} ledger={ledger} onClose={() => setShowImport(false)} />
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header title={"Invite"}>Invite</Modal.Header>
        <Modal.Body>
          {showInviteModal && (
            <InviteFriends
              logId={ledger.id}
              logKind="ledger"
              memberIds={ledger.members.map((ref) => ref.id)}
              spotsLeft={spots}
            />
          )}
          <h4>or share a link</h4>
          <p>Send the following URL to anyone you want to share this financial log with.</p>
          <p>Members can see every entry in this log, and add their own.</p>
          <CopyTextArea value={shareUrl(`/l/${ledger.id}/invite`)} />
          <ShareLinkButton
            title={`Join ${ledger.title} on moneylogs`}
            url={shareUrl(`/l/${ledger.id}/invite`)}
          />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Close" />
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default LedgerShell;
