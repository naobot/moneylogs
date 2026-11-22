import { useId, useState } from "react";
import { Link } from "react-router-dom";

import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { useToastContext } from "@/hooks/useToastContext";
import { Ledger } from "@/types/ledger";
import { track } from "@/utils/analytics";
import { formatMonth, MAX_CATEGORY_NAME_LENGTH, monthKeyOf, todayInTz } from "@/utils/ledger";
import { reportError } from "@/utils/reportError";
import {
  isActiveSublog,
  parentChoices,
  shouldAutoOpenSublogIntro,
  sublogBlocker,
} from "@/utils/sublogs";
import SublogIntro from "./SublogIntro";
import { ALL_MONTHS, linkSublog, sublogErrorMessage, unlinkSublog } from "./sublogApi";
import { SublogName } from "./SublogName";

/**
 * "part of another log" in a ledger's Manage modal. Depending on the log:
 * - a sublog: where it counts, and unlinking;
 * - a parent: its sublogs, each of which can be unlinked;
 * - otherwise: linking it to another of your logs.
 * A personal log is always the top, so it gets no section unless it has sublogs.
 */
export const SublogSection = ({ ledger }: { ledger: Ledger }) => {
  const { ledgers } = useGetMyLedgers();
  const blocker = sublogBlocker(ledger);
  const sublogs = (ledger.categories ?? []).filter(isActiveSublog);

  if (ledger.parentLink) return <LinkedSection ledger={ledger} ledgers={ledgers} />;
  if (sublogs.length > 0) return <ParentSection ledger={ledger} ledgers={ledgers} />;
  if (blocker) return null;
  return <LinkForm ledger={ledger} ledgers={ledgers} />;
};

/** An unlink button that asks once, in place, spelling out what happens. */
const UnlinkButton = ({
  childId,
  lineName,
  parentTitle,
  from,
}: {
  childId: string;
  lineName: string;
  parentTitle?: string;
  from: "sublog" | "parent";
}) => {
  const { showToast } = useToastContext();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlink = async () => {
    setBusy(true);
    setError(null);
    try {
      await unlinkSublog(childId);
      track("sublog_unlinked", { from });
      showToast(
        `${lineName} no longer counts${parentTitle ? ` in ${parentTitle}` : ""}`,
        "success",
      );
      setConfirming(false);
    } catch (err) {
      const { message, expected } = sublogErrorMessage(err);
      if (!expected) reportError(err, { feature: "sublogs", action: "unlink" });
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <RowButton onClick={() => setConfirming(true)} aria-label={`unlink ${lineName}`}>
        unlink
      </RowButton>
    );
  }
  return (
    <div className="SublogSection__confirm">
      <p>
        From now on, spending in <strong className="keep-case">{lineName}</strong> stops counting
        {parentTitle ? (
          <>
            {" "}
            in <strong className="keep-case">{parentTitle}</strong>
          </>
        ) : null}
        . Months up to now keep the totals they show, and the line becomes an ordinary category.
        Both logs and all their entries stay.
      </p>
      <div className="SublogSection__buttons">
        <Button
          text="Nevermind"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => setConfirming(false)}
        />
        <Button text="Unlink" size="sm" loading={busy} onClick={() => void unlink()} />
      </div>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

/** This log is a sublog: where it counts. */
const LinkedSection = ({ ledger, ledgers }: { ledger: Ledger; ledgers: ReadonlyArray<Ledger> }) => {
  const link = ledger.parentLink!;
  const parent = ledgers.find((l) => l.id === link.ledgerId);
  const line = parent?.categories?.find((c) => c.id === link.categoryId)?.name ?? ledger.title;
  return (
    <section className="LogActions__section SublogSection">
      <h4>part of another log</h4>
      {parent ? (
        <p>
          <SublogName name={line} /> counts in{" "}
          <Link to={`/l/${parent.id}`} className="keep-case">
            {parent.title} ›
          </Link>
          {link.since === ALL_MONTHS ? ", all its months." : `, from ${formatMonth(link.since)}.`}{" "}
          Spending by people in both logs counts there.
        </p>
      ) : (
        <p>A member also counts their spending here in another log you&apos;re not in.</p>
      )}
      <UnlinkButton childId={ledger.id} lineName={line} parentTitle={parent?.title} from="sublog" />
    </section>
  );
};

/** This log has sublogs: each can be unlinked from here too. */
const ParentSection = ({ ledger, ledgers }: { ledger: Ledger; ledgers: ReadonlyArray<Ledger> }) => {
  const mine = new Set(ledgers.map((l) => l.id));
  const sublogs = (ledger.categories ?? []).filter(isActiveSublog);
  return (
    <section className="LogActions__section SublogSection">
      <h4>sublogs</h4>
      <p>These logs each count as one line here. Their entries stay in their own logs.</p>
      <ul className="SublogSection__list">
        {sublogs.map((c) => {
          const childId = c.sublog!.ledgerId;
          return (
            <li key={c.id}>
              <SublogName name={c.name} to={mine.has(childId) ? `/l/${childId}` : undefined} />
              <UnlinkButton
                childId={childId}
                lineName={c.name}
                parentTitle={ledger.title}
                from="parent"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** Not linked yet: pick a parent, the line's name, and which months count. */
const LinkForm = ({ ledger, ledgers }: { ledger: Ledger; ledgers: ReadonlyArray<Ledger> }) => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const uid = user?.userId ?? "";
  const choices = parentChoices(ledgers, uid, ledger);
  const firstOpen = choices.find((c) => !c.disabledReason)?.ledger.id ?? "";
  const [parentId, setParentId] = useState("");
  const [name, setName] = useState(ledger.title);
  const [includePast, setIncludePast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parentFieldId = useId();
  const nameFieldId = useId();
  // "What's a sublog?" opens over the Manage window the first time the form shows.
  const [introClosed, setIntroClosed] = useState(false);
  const [introAsked, setIntroAsked] = useState(false);

  if (!user || !choices.some((c) => !c.disabledReason)) return null;
  const introAuto = shouldAutoOpenSublogIntro(user) && !introClosed;
  const chosenId = parentId || firstOpen;
  const parent = choices.find((c) => c.ledger.id === chosenId)?.ledger;
  const sharedWith = (parent?.memberUids?.length ?? 1) - 1;
  const lineName = name.trim() || ledger.title;

  const link = async () => {
    if (!parent) return;
    setBusy(true);
    setError(null);
    try {
      await linkSublog({
        childId: ledger.id,
        parentId: parent.id,
        name: lineName,
        since: includePast ? ALL_MONTHS : monthKeyOf(todayInTz(user.timezone)),
      });
      track("sublog_linked", {
        from: "log_actions",
        include_past: includePast,
        shared_parent: sharedWith > 0,
      });
      showToast(`${lineName} now counts in ${parent.title}`, "success");
    } catch (err) {
      const { message, expected } = sublogErrorMessage(err);
      if (!expected) reportError(err, { feature: "sublogs", action: "link" });
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="LogActions__section SublogSection">
      <h4>part of another log</h4>
      <SublogIntro
        isOpen={introAsked || introAuto}
        from={introAsked ? "help" : "link_form"}
        onClose={() => {
          setIntroClosed(true);
          setIntroAsked(false);
        }}
      />
      <p>
        Count the spending here as one line in another of your logs.{" "}
        <button type="button" className="SublogHelp" onClick={() => setIntroAsked(true)}>
          what&apos;s a sublog?
        </button>
      </p>
      <div className="SublogSection__field">
        <label htmlFor={parentFieldId}>part of</label>
        <select
          id={parentFieldId}
          className="keep-case"
          value={chosenId}
          disabled={busy}
          onChange={(e) => setParentId(e.target.value)}
        >
          {choices.map(({ ledger: l, disabledReason }) => (
            <option key={l.id} value={l.id} disabled={!!disabledReason}>
              {l.title}
              {disabledReason ? ` (${disabledReason})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="SublogSection__field">
        <label htmlFor={nameFieldId}>counts as</label>
        <input
          id={nameFieldId}
          className="LineInput keep-case"
          value={name}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <fieldset className="SublogSection__months" disabled={busy}>
        <legend>which months</legend>
        <label>
          <input type="radio" checked={!includePast} onChange={() => setIncludePast(false)} />
          from this month on
        </label>
        <label>
          <input type="radio" checked={includePast} onChange={() => setIncludePast(true)} />
          all its months
        </label>
      </fieldset>
      <p className="SublogSection__note">
        {includePast
          ? `${parent?.title ?? "That log"}'s past months will include this log's spending. If you used to log it there by hand too, those months will count it twice.`
          : `${parent?.title ?? "That log"}'s past months stay as they are.`}
        {sharedWith > 0 &&
          ` Everyone in ${parent?.title} will see a ${lineName} line in its stats; only spending by people in both logs counts.`}
      </p>
      <Button
        text="Link"
        size="sm"
        className="LogActions__action"
        loading={busy}
        disabled={!parent || busy}
        onClick={() => void link()}
      />
      {error && <p className="error-message">{error}</p>}
    </section>
  );
};

export default SublogSection;
