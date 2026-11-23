import { ReactNode, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import cx from "classnames";
import dayjs from "@/utils/configuredDayjs";
import { formatDate, formatTime } from "@/utils/dateFormat";

import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { FriendPicker } from "@/features/invites/FriendPicker";
import { inviteFriendsToLog } from "@/features/invites/logInvites";
import type { LogKind } from "@/types/notification";
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery";
import { useLedgerQuery } from "@/hooks/useLedgerQuery";
import { useGetLedger } from "@/hooks/useGetLedger";
import { writeSelfNotification } from "@/hooks/useNotifications";
import { Currency } from "@/types/user";
import { ledgerStartCurrency } from "@/utils/currency";
import { reportError } from "@/utils/reportError";
import { isEmailUnconfirmedError } from "@/utils/confirmedEmail";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { monthKeyOf, todayInTz } from "@/utils/ledger";
import { parentChoices, shouldAutoOpenSublogIntro } from "@/utils/sublogs";
import SublogIntro from "@/features/ledger/sublogs/SublogIntro";
import { linkSublog, sublogErrorMessage } from "@/features/ledger/sublogs/sublogApi";

import ControlledInput from "@/components/ControlledInput";
import Wizard from "@/components/Wizard/Wizard";
import CurrencySelect from "@/components/CurrencySelect";

import {
  friendsToInvite,
  isStepValid,
  LogMode,
  MAX_PARTICIPANTS,
  participantsError,
  reachableStepIndex,
  scheduleError,
  STEP_LABELS,
  stepsFor,
  stepsForState,
  sublogLineName,
  sublogNameError,
  titleError,
  WizardState,
} from "./wizardSteps";
import { track } from "@/utils/analytics";

const initialState = (defaultCurrency: Currency): WizardState => ({
  mode: null,
  title: "",
  maxParticipants: 10,
  startDate: dayjs().format("YYYY-MM-DD"),
  startTime: "00:00",
  endDate: dayjs().add(1, "month").format("YYYY-MM-DD"),
  endTime: "23:59",
  defaultCurrency,
  inviteFriendIds: [],
  parentId: null,
  sublogName: "",
});

const MODE_OPTIONS: Array<{ mode: LogMode; title: string; lines: string[] }> = [
  {
    mode: "social",
    title: "Social",
    lines: [
      "A time-boxed log group, up to a month long.",
      "Everyone posts about their day's spending; insights unlock when it ends.",
    ],
  },
  {
    mode: "financial",
    title: "Financial",
    lines: [
      "An ongoing spending tracker with no end date.",
      "One entry per purchase, by category, with stats that are always on.",
    ],
  },
];

const fmtDateTime = (date: string, time: string) => {
  const at = dayjs(`${date}T${time}`);
  return `${formatDate(dayjs(date))} ${at.isValid() ? formatTime(at) : time}`;
};

export const CreateLogWizard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useCurrentUser();
  const { addNewLogGroup } = useLogGroupQuery();
  const { createLedger } = useLedgerQuery();
  const { showToast } = useToastContext();
  // Held from the first write until we navigate away, across every step of creating (the
  // log, then linking and inviting), so Next can't create a second log in the gaps.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [state, setState] = useState<WizardState>(() => initialState(ledgerStartCurrency(user)));
  const update = (patch: Partial<WizardState>) => setState((prev) => ({ ...prev, ...patch }));

  const steps = stepsForState(state);
  // The step lives in the URL so the browser back button walks back through the wizard.
  const stepIndex = reachableStepIndex(Number(searchParams.get("step") ?? 0), state);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const canAdvance = isStepValid(step, state);

  const submitFailed = addNewLogGroup.isError || createLedger.isError;

  // Logs this one could be part of (the "parent" step), personal first.
  const { ledgers: myLedgers } = useGetMyLedgers();
  const parents = parentChoices(myLedgers, user?.userId ?? "");
  const parent = parents.find((c) => c.ledger.id === state.parentId)?.ledger;
  // "What's a sublog?": opens by itself the first time someone reaches the step, and
  // from its link any time.
  const [introClosed, setIntroClosed] = useState(false);
  const [introAsked, setIntroAsked] = useState(false);

  // Best effort, like invites: the log exists either way, and can be linked from its
  // Manage menu later.
  const linkToParent = async (ledgerId: string) => {
    if (!parent || !user) return;
    const sharedParent = (parent.memberUids?.length ?? 1) > 1;
    try {
      await linkSublog({
        childId: ledgerId,
        parentId: parent.id,
        name: sublogLineName(state),
        // A new log has no history: it counts from this month.
        since: monthKeyOf(todayInTz(user.timezone)),
      });
      track("sublog_linked", { from: "wizard", include_past: false, shared_parent: sharedParent });
    } catch (err) {
      const { expected } = sublogErrorMessage(err);
      if (!expected) reportError(err, { feature: "sublogs", action: "link_on_create" });
      showToast(
        `Your log is ready, but it doesn't count in ${parent.title} yet. Link it from its manage menu.`,
      );
    }
  };

  const goTo = (index: number) => {
    setSearchParams(index === 0 ? {} : { step: String(index) });
  };

  // Best effort: the log exists either way, and invites can be sent again from inside it.
  const sendInvites = async (logId: string, logKind: LogKind) => {
    const friendIds = friendsToInvite(state);
    if (!friendIds.length) return;
    try {
      await inviteFriendsToLog(logId, logKind, friendIds);
    } catch (err) {
      if (isEmailUnconfirmedError(err)) {
        showToast(
          "Your log is ready. Confirm your email, then invite friends from its invite button.",
        );
        return;
      }
      reportError(err, { feature: "log_invites", action: "invite_on_create", tags: { logKind } });
      showToast(
        "Your log is ready, but the invites didn't go out. Try again from its invite button.",
      );
    }
  };

  const submit = async () => {
    if (!user?.userId || !state.mode || !isStepValid("review", state)) return;
    setIsSubmitting(true);
    try {
      if (state.mode === "social") {
        const title = state.title.trim();
        const groupId = await addNewLogGroup.mutate({
          title,
          max_participants: state.maxParticipants,
          startWallClock: `${state.startDate}T${state.startTime}`,
          endWallClock: `${state.endDate}T${state.endTime}`,
          currentUserId: user.userId,
        });
        void writeSelfNotification({
          userDocId: user.id,
          prefs: user.notificationPrefs,
          type: "log_created",
          groupId,
          groupName: title,
          logKind: "social",
        });
        track("create_log", {
          log_kind: "social",
          invited_friends: friendsToInvite(state).length,
        });
        await sendInvites(groupId, "social");
        void navigate("/", { replace: true });
      } else {
        const ledgerId = await createLedger.mutate({
          title: state.title,
          max_participants: state.maxParticipants,
          defaultCurrency: state.defaultCurrency,
          member: { uid: user.userId, userDocId: user.id },
        });
        void writeSelfNotification({
          userDocId: user.id,
          prefs: user.notificationPrefs,
          type: "log_created",
          groupId: ledgerId,
          groupName: state.title.trim(),
          logKind: "ledger",
        });
        track("create_log", {
          log_kind: "financial",
          invited_friends: friendsToInvite(state).length,
        });
        await linkToParent(ledgerId);
        await sendInvites(ledgerId, "ledger");
        void navigate(`/l/${ledgerId}`, { replace: true });
      }
    } catch (err) {
      reportError(err, {
        feature: "create_log",
        action: "create_log",
        tags: { mode: state.mode },
      });
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!canAdvance || isSubmitting) return;
    if (isLast) void submit();
    else goTo(stepIndex + 1);
  };

  const chooseMode = (mode: LogMode) => {
    update({ mode });
    // Picking a type is the whole step, so move straight on.
    setSearchParams({ step: "1" });
  };

  const scheduleMessage = scheduleError(state.startDate, state.endDate);
  // New users already have a solo "personal" financial log (made at sign-up), and some
  // came here thinking they needed to create one. Point at it while they pick a type,
  // as long as it still exists (deleted personal logs stay deleted).
  const personal = useGetLedger(user?.personalLedgerId, step === "type");

  let body: ReactNode = null;
  switch (step) {
    case "type":
      body = (
        <>
          <h3 className="Wizard__question">What kind of log are you starting?</h3>
          {personal.ledger && (
            <p className="Wizard__note">
              You already have a financial log just for you:{" "}
              <Link to={`/l/${personal.ledger.id}`} className="keep-case">
                {personal.ledger.title}
              </Link>
              , for everyday spending. Another one can be handy to keep something separate, like a
              trip, a household budget shared with a partner, or a side project.
            </p>
          )}
          <div className="Wizard__choices" role="radiogroup" aria-label="Log type">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={state.mode === option.mode}
                className={cx("Wizard__choice", {
                  "Wizard__choice--selected": state.mode === option.mode,
                })}
                onClick={() => chooseMode(option.mode)}
              >
                <strong>{option.title}</strong>
                {option.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </button>
            ))}
          </div>
        </>
      );
      break;

    case "basics":
      body = (
        <>
          <h3 className="Wizard__question">Give it a name</h3>
          <ControlledInput
            label="Title"
            value={state.title}
            onChange={(e) => update({ title: e.target.value })}
            isError={!!titleError(state.title)}
            errorMessage={titleError(state.title)}
          />
          <ControlledInput
            label="Max no. of participants"
            type="number"
            min={1}
            max={MAX_PARTICIPANTS}
            value={state.maxParticipants}
            onChange={(e) => update({ maxParticipants: Number(e.target.value) })}
            isError={!!participantsError(state.maxParticipants)}
            errorMessage={participantsError(state.maxParticipants)}
          />
          <p className="Wizard__hint">
            {state.mode === "financial"
              ? "Set this to 1 to keep the log to yourself. You can invite others later if there's room."
              : "You can invite friends in a later step, or with a link once the group is created."}
          </p>
        </>
      );
      break;

    case "schedule":
      body = (
        <>
          <h3 className="Wizard__question">When does it run?</h3>
          <ControlledInput
            label="Start date"
            type="date"
            value={state.startDate}
            onChange={(e) => update({ startDate: e.target.value })}
          />
          <ControlledInput
            label="Start time (your local time)"
            type="time"
            value={state.startTime}
            onChange={(e) => update({ startTime: e.target.value })}
          />
          <ControlledInput
            label="End date"
            type="date"
            value={state.endDate}
            onChange={(e) => update({ endDate: e.target.value })}
            isError={!!scheduleMessage}
            errorMessage={scheduleMessage}
          />
          <ControlledInput
            label="End time (your local time)"
            type="time"
            value={state.endTime}
            onChange={(e) => update({ endTime: e.target.value })}
          />
          <p className="Wizard__hint">Log groups can run for up to a month.</p>
        </>
      );
      break;

    case "parent": {
      const sharedWith = (parent?.memberUids?.length ?? 1) - 1;
      body = (
        <>
          <h3 className="Wizard__question">part of another log?</h3>
          <p className="Wizard__hint">
            Your spending in <span className="keep-case">{state.title.trim()}</span> can also count
            as one line in a log you already keep, like a trip inside your everyday spending.{" "}
            <button type="button" className="SublogHelp" onClick={() => setIntroAsked(true)}>
              what&apos;s a sublog?
            </button>
          </p>
          <div className="Wizard__choices" role="radiogroup" aria-label="Part of">
            <button
              type="button"
              role="radio"
              aria-checked={state.parentId === null}
              className={cx("Wizard__choice", {
                "Wizard__choice--selected": state.parentId === null,
              })}
              onClick={() => update({ parentId: null })}
            >
              <strong>no, it stands alone</strong>
            </button>
            {parents.map(({ ledger, disabledReason }) => {
              const others = (ledger.memberUids?.length ?? 1) - 1;
              return (
                <button
                  key={ledger.id}
                  type="button"
                  role="radio"
                  aria-checked={state.parentId === ledger.id}
                  disabled={!!disabledReason}
                  className={cx("Wizard__choice", {
                    "Wizard__choice--selected": state.parentId === ledger.id,
                  })}
                  onClick={() => update({ parentId: ledger.id })}
                >
                  <strong className="keep-case">{ledger.title}</strong>
                  <span>
                    {disabledReason ??
                      (others > 0
                        ? `shared with ${others} other${others > 1 ? "s" : ""}`
                        : "just you")}
                  </span>
                </button>
              );
            })}
          </div>
          {parent && (
            <>
              <ControlledInput
                label="Counts as"
                value={state.sublogName || state.title.trim()}
                onChange={(e) => update({ sublogName: e.target.value })}
                isError={!!sublogNameError(state.sublogName)}
                errorMessage={sublogNameError(state.sublogName)}
              />
              <p className="Wizard__hint">
                Its total shows as one line in <span className="keep-case">{parent.title}</span>,
                from this month on. You log the details here.
                {sharedWith > 0 &&
                  ` Everyone in ${parent.title} will see that line; only spending by people in both logs counts there.`}
              </p>
            </>
          )}
        </>
      );
      break;
    }

    case "currency":
      body = (
        <>
          <h3 className="Wizard__question">What currency do you usually spend in?</h3>
          <CurrencySelect
            id="wizard-default-currency"
            label="Default currency"
            value={state.defaultCurrency}
            onChange={(defaultCurrency) => update({ defaultCurrency })}
          />
          <p className="Wizard__hint">
            New entries start in this currency, but any entry can use a different one. Totals are
            kept per currency and never converted.
          </p>
        </>
      );
      break;

    case "friends":
      body = (
        <>
          <h3 className="Wizard__question">Invite friends?</h3>
          <FriendPicker
            selected={state.inviteFriendIds}
            onChange={(inviteFriendIds) => update({ inviteFriendIds })}
            max={state.maxParticipants - 1}
          />
          <p className="Wizard__hint">
            Optional. Each friend you pick gets an invite in their notifications once the log is
            created. You can also share a link from inside the log.
          </p>
        </>
      );
      break;

    case "review":
      body = (
        <>
          <h3 className="Wizard__question">Ready to go?</h3>
          <dl className="Wizard__review">
            <dt>Type</dt>
            <dd>{state.mode === "social" ? "Social log group" : "Financial log"}</dd>
            <dt>Title</dt>
            <dd>{state.title.trim()}</dd>
            <dt>Participants</dt>
            <dd>{state.maxParticipants === 1 ? "Just you" : `Up to ${state.maxParticipants}`}</dd>
            {friendsToInvite(state).length > 0 && (
              <>
                <dt>Inviting</dt>
                <dd>
                  {friendsToInvite(state).length} friend
                  {friendsToInvite(state).length > 1 && "s"}
                </dd>
              </>
            )}
            {state.mode === "social" ? (
              <>
                <dt>Runs</dt>
                <dd>
                  {fmtDateTime(state.startDate, state.startTime)} to{" "}
                  {fmtDateTime(state.endDate, state.endTime)}
                </dd>
              </>
            ) : (
              <>
                <dt>Part of</dt>
                <dd>
                  {parent ? (
                    <>
                      <span className="keep-case">{parent.title}</span>, as{" "}
                      <span className="keep-case">{sublogLineName(state)}</span>
                    </>
                  ) : (
                    "nothing: it stands alone"
                  )}
                </dd>
                <dt>Default currency</dt>
                <dd>{state.defaultCurrency}</dd>
                <dt>Categories</dt>
                <dd>Starts with 10 common categories. You can customise them later.</dd>
              </>
            )}
          </dl>
          {submitFailed && (
            <div className="error-message">Failed to create your log. Please try again.</div>
          )}
        </>
      );
      break;
  }

  const labels = (state.mode ? steps : stepsFor("social", true)).map((s, i) =>
    i === 2 && !state.mode ? "Details" : STEP_LABELS[s],
  );

  const introAuto = step === "parent" && shouldAutoOpenSublogIntro(user) && !introClosed;

  return (
    <>
      <SublogIntro
        isOpen={introAsked || introAuto}
        from={introAsked ? "help" : "wizard"}
        onClose={() => {
          setIntroClosed(true);
          setIntroAsked(false);
        }}
      />
      <Wizard
        className="CreateNewLog CreateLogWizard"
        labels={labels}
        stepIndex={stepIndex}
        onBack={() => goTo(stepIndex - 1)}
        onNext={handleNext}
        showNext={step !== "type"}
        nextText={
          isLast ? (state.mode === "social" ? "Start log group" : "Start financial log") : "Next"
        }
        nextDisabled={!canAdvance || (isLast && !user?.userId)}
        busy={isSubmitting}
      >
        {body}
      </Wizard>
    </>
  );
};

export default CreateLogWizard;
