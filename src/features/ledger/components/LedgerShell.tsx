import { ReactNode, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useLedgerCategoryQuery } from "@/hooks/useLedgerCategoryQuery";
import { Ledger } from "@/types/ledger";
import { Currency } from "@/types/user";
import ShareLinkButton from "@/features/layout/components/ShareLinkButton";
import { hourInTz, LedgerView, monthKeyOf, spotsLeft, todayInTz } from "@/utils/ledger";
import {
  currentPeriodLabel,
  formatPeriod,
  monthWithin,
  parsePeriod,
  Period,
  periodOf,
  periodSearchParams,
  samePeriod,
  ledgerPeriodPath,
  shiftPeriod,
} from "@/utils/ledgerPeriods";
import CopyTextArea from "@/features/layout/components/CopyTextArea";
import { IconText } from "@/components/Icon";
import Modal from "@/components/Modal";
import CategoryManager from "./CategoryManager";
import BudgetManager from "./BudgetManager";
import MonthlyTotalModal from "./MonthlyTotalModal";
import ImportModal from "@/features/ledger/import/ImportModal";
import LogActionsModal from "@/features/logActions/LogActionsModal";
import LedgerCurrencySection from "./LedgerCurrencySection";
import SublogSection from "@/features/ledger/sublogs/SublogSection";
import SublogCrumb from "@/features/ledger/sublogs/SublogCrumb";
import LedgerSidebar from "./LedgerSidebar";
import useMediaQuery from "@/hooks/useMediaQuery";
import { creatorUid } from "@/utils/logOwnership";
import { shareUrl } from "@/utils/shareUrl";
import InviteFriends from "@/features/invites/FriendPicker";
import { BudgetBuddy } from "@/features/ledger/buddy/BudgetBuddy";
import { LedgerTourProvider, useLedgerTour } from "@/features/ledger/tour/LedgerTour";
import ShareCardModal from "@/features/share/ShareCardModal";
import { shareDayOf } from "@/features/share/shareLines";

import "./Ledger.scss";

/**
 * When the right-hand column shows (Ledger.scss hides it at max-width: md, 768px, where
 * the layout stacks). One pixel past md so the two never disagree at exactly 768px.
 */
const ASIDE_QUERY = "(min-width: 769px)";

export type LedgerShellContext = {
  /** The month shown on the entries view, or the month within the stats period. */
  month: string;
  /** What the stats view covers: a month, a quarter or a year. Always a month on entries. */
  period: Period;
  today: string;
  setMonth: (month: string) => void;
  /** Opens the monthly budgets editor. */
  openBudgets: () => void;
  /** Opens the month's total budget, on one currency. */
  openTotal: (currency: Currency) => void;
};

type LedgerShellProps = {
  ledger: Ledger;
  view: LedgerView;
  children: (ctx: LedgerShellContext) => ReactNode;
};

/**
 * Shared frame for a ledger's pages: header (title, categories, invite), the sidebar that
 * switches between entries and stats and picks the stats period, and the period switcher.
 * The viewed period lives in ?month= / ?quarter= / ?year= so refresh, back and switching
 * views keep your place.
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
  const navigate = useNavigate();
  // One buddy, never two (each would ask its own questions): in the right-hand column
  // on wide screens, at the end of the period row below that.
  const wide = useMediaQuery(ASIDE_QUERY);
  const [aside, setAside] = useState<HTMLDivElement | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);
  const [totalCurrency, setTotalCurrency] = useState<Currency | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showShareToday, setShowShareToday] = useState(false);
  const { saveCategoryOps, isCategoryUsed } = useLedgerCategoryQuery();

  const spots = spotsLeft(ledger);
  const isShared = (ledger.memberUids?.length ?? 0) > 1;

  const today = todayInTz(user?.timezone);
  const currentMonth = monthKeyOf(today);
  const period = parsePeriod(searchParams, currentMonth, view);
  const month = monthWithin(period, currentMonth);
  const currentPeriod = periodOf(currentMonth, period.kind);
  const setPeriod = (next: Period) => setSearchParams(periodSearchParams(next, currentMonth));
  const setMonth = (next: string) => setPeriod({ kind: "month", key: next });

  // Always about this month, whichever period is being browsed.
  const buddy = (
    <div className="Ledger__month__buddy">
      {tip("buddy")}
      <BudgetBuddy
        ledger={ledger}
        // In the column its bubble stays in the column; on phones it may use the screen.
        bubbleBounds={wide ? aside : null}
        onStartReview={(m) =>
          navigate(ledgerPeriodPath(ledger.id, "stats", { kind: "month", key: m }, currentMonth))
        }
      />
      <RowButton className="Ledger__month__share" onClick={() => setShowShareToday(true)}>
        share {shareDayOf(today, hourInTz(user?.timezone)).word}
      </RowButton>
    </div>
  );

  return (
    <>
      <div className="Group Ledger">
        <div className="Group__header">
          <div className="Group__header__left">
            <div className="Group__header__item Ledger__kind">
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
                <div className="Group__header__item Ledger__spots">
                  <small>
                    ({spots}
                    <span className="Ledger__spots__long"> spot{spots > 1 && "s"}</span> left)
                  </small>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="Ledger__layout">
          <LedgerSidebar
            ledgerId={ledger.id}
            view={view}
            period={period}
            currentMonth={currentMonth}
          />
          <div className="Ledger__body">
            <SublogCrumb ledger={ledger} />
            <nav className="Ledger__month" aria-label="Period">
              <div className="Ledger__month__controls">
                {tip("month", ".Ledger__month__label")}
                <RowButton
                  glyph
                  aria-label={`Previous ${period.kind}`}
                  onClick={() => setPeriod(shiftPeriod(period, -1))}
                >
                  ‹
                </RowButton>
                <strong className="Ledger__month__label">{formatPeriod(period)}</strong>
                <RowButton
                  glyph
                  aria-label={`Next ${period.kind}`}
                  onClick={() => setPeriod(shiftPeriod(period, 1))}
                >
                  ›
                </RowButton>
                {!samePeriod(period, currentPeriod) && (
                  <RowButton onClick={() => setPeriod(currentPeriod)}>
                    {currentPeriodLabel(period.kind)}
                  </RowButton>
                )}
              </div>
              {!wide && buddy}
            </nav>

            {children({
              month,
              period,
              today,
              setMonth,
              openBudgets: () => setShowBudgets(true),
              openTotal: setTotalCurrency,
            })}
          </div>
          {/* The right-hand column, like the social log's comments: it holds the buddy on
              wide screens and keeps the main column centred against the sidebar. */}
          <div ref={setAside} className="Ledger__aside">
            {wide && buddy}
          </div>
        </div>
      </div>
      {showShareToday && (
        <ShareCardModal
          card="daily"
          ledger={ledger}
          today={today}
          onClose={() => setShowShareToday(false)}
        />
      )}
      <LogActionsModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        logId={ledger.id}
        logTitle={ledger.title}
        kind="financial"
        creatorUid={creatorUid(ledger, "financial")}
        settings={
          <>
            <LedgerCurrencySection ledger={ledger} />
            {showManageModal && <SublogSection ledger={ledger} />}
          </>
        }
      />
      <CategoryManager
        isOpen={showCategories}
        categories={ledger.categories ?? []}
        defaultCurrency={ledger.defaultCurrency}
        onClose={() => setShowCategories(false)}
        onSave={(ops) => saveCategoryOps.mutate({ ledgerId: ledger.id, ops, month: currentMonth })}
        checkInUse={(categoryId) => isCategoryUsed.mutate({ ledgerId: ledger.id, categoryId })}
      />
      <BudgetManager
        isOpen={showBudgets}
        categories={ledger.categories ?? []}
        defaultCurrency={ledger.defaultCurrency}
        onClose={() => setShowBudgets(false)}
        onSave={(ops) => saveCategoryOps.mutate({ ledgerId: ledger.id, ops, month: currentMonth })}
        totals={ledger.monthlyBudget}
        onEditTotal={(currency) => {
          setShowBudgets(false);
          setTotalCurrency(currency);
        }}
      />
      <MonthlyTotalModal
        isOpen={totalCurrency !== null}
        currency={totalCurrency ?? ledger.defaultCurrency}
        totals={ledger.monthlyBudget}
        categories={ledger.categories ?? []}
        onClose={() => setTotalCurrency(null)}
        onSave={(totalOps) =>
          saveCategoryOps.mutate({ ledgerId: ledger.id, ops: [], totalOps, month: currentMonth })
        }
        onEditCategories={() => setShowBudgets(true)}
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
          <CopyTextArea value={shareUrl(`/l/${ledger.id}/invite`)} shareContent="log_invite" />
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
