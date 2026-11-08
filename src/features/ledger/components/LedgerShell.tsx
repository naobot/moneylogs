import { ReactNode, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useLedgerCategoryQuery } from "@/hooks/useLedgerCategoryQuery";
import { Ledger } from "@/types/ledger";
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
import LogActionsModal from "@/features/logs/LogActionsModal";

import "./Ledger.scss";

export type LedgerShellContext = {
  month: string;
  today: string;
  setMonth: (month: string) => void;
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
export const LedgerShell = ({ ledger, view, children }: LedgerShellProps) => {
  const { user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
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
              {isShared ? `shared · ${ledger.memberUids.length} members` : "personal"}
            </div>
          </div>
          <div className="Group__header__center">
            <div className="Group__header__item Group__header__title">{ledger.title}</div>
          </div>
          <div className="Group__header__right">
            <div className="handler Group__header__item" onClick={() => setShowManageModal(true)}>
              <IconText type={"pencil"} fill={"white"} text="manage" />
            </div>
            <div className="handler Group__header__item" onClick={() => setShowCategories(true)}>
              <IconText type={"pencil"} fill={"white"} text="categories" />
            </div>
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
            <button
              type="button"
              className="Ledger__month__step"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </button>
            <strong className="Ledger__month__label">{formatMonth(month)}</strong>
            <button
              type="button"
              className="Ledger__month__step"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </button>
            {month !== currentMonth && (
              <button
                type="button"
                className="Ledger__month__today"
                onClick={() => setMonth(currentMonth)}
              >
                this month
              </button>
            )}
            <Link
              className="Ledger__month__view"
              to={ledgerViewPath(ledger.id, otherView, month, currentMonth)}
            >
              {otherView === "stats" ? "stats ›" : "‹ entries"}
            </Link>
          </nav>

          {children({ month, today, setMonth })}
        </div>
      </div>
      <LogActionsModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        logId={ledger.id}
        logTitle={ledger.title}
        kind="financial"
      />
      <CategoryManager
        isOpen={showCategories}
        categories={ledger.categories ?? []}
        defaultCurrency={ledger.defaultCurrency}
        onClose={() => setShowCategories(false)}
        isSaving={saveCategoryOps.isLoading}
        onSave={(ops) => saveCategoryOps.mutate({ ledgerId: ledger.id, ops })}
        checkInUse={(categoryId) => isCategoryUsed.mutate({ ledgerId: ledger.id, categoryId })}
      />
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header title={"Invite"}>Invite</Modal.Header>
        <Modal.Body>
          <p>Send the following URL to anyone you want to share this financial log with.</p>
          <p>Members can see every entry in this log, and add their own.</p>
          <CopyTextArea value={`${window.location.host}/l/${ledger.id}/invite`} />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Close" />
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default LedgerShell;
