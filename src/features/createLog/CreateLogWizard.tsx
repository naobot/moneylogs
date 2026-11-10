import { FormEvent, KeyboardEvent, ReactNode, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import cx from "classnames";
import dayjs from "@/utils/configuredDayjs";
import { formatDate, formatTime } from "@/utils/dateFormat";

import { useCurrentUser } from "@/contexts";
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery";
import { useLedgerQuery } from "@/hooks/useLedgerQuery";
import { writeSelfNotification } from "@/hooks/useNotifications";
import { Currency } from "@/types/user";
import { CURRENCIES, isCurrency, LAST_CURRENCY_KEY } from "@/utils/currency";

import ControlledInput from "@/components/ControlledInput";
import Button from "@/components/Button";

import {
  isStepValid,
  LogMode,
  MAX_PARTICIPANTS,
  participantsError,
  reachableStepIndex,
  scheduleError,
  STEP_LABELS,
  stepsFor,
  titleError,
  WizardState,
} from "./wizardSteps";

import "./CreateLogWizard.scss";

const initialCurrency = (): Currency => {
  try {
    const last = localStorage.getItem(LAST_CURRENCY_KEY);
    return isCurrency(last) ? last : "JPY";
  } catch {
    return "JPY";
  }
};

const initialState = (): WizardState => ({
  mode: null,
  title: "",
  maxParticipants: 10,
  startDate: dayjs().format("YYYY-MM-DD"),
  startTime: "00:00",
  endDate: dayjs().add(1, "month").format("YYYY-MM-DD"),
  endTime: "23:59",
  defaultCurrency: initialCurrency(),
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

  const [state, setState] = useState<WizardState>(initialState);
  const update = (patch: Partial<WizardState>) => setState((prev) => ({ ...prev, ...patch }));

  const steps = stepsFor(state.mode);
  // The step lives in the URL so the browser back button walks back through the wizard.
  const stepIndex = reachableStepIndex(Number(searchParams.get("step") ?? 0), state);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const canAdvance = isStepValid(step, state);

  const isSubmitting = addNewLogGroup.isLoading || createLedger.isLoading;
  const submitFailed = addNewLogGroup.isError || createLedger.isError;

  const goTo = (index: number) => {
    setSearchParams(index === 0 ? {} : { step: String(index) });
  };

  const submit = async () => {
    if (!user?.userId || !state.mode || !isStepValid("review", state)) return;
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
        void navigate(`/l/${ledgerId}`, { replace: true });
      }
    } catch (err) {
      console.error("Failed to create log:", err);
    }
  };

  const handleNext = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canAdvance || isSubmitting) return;
    if (isLast) void submit();
    else goTo(stepIndex + 1);
  };

  // Enter in a text/number/date input advances, without relying on implicit form
  // submission (inconsistent across browsers when there's no visible submit button).
  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (!(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    handleNext();
  };

  const chooseMode = (mode: LogMode) => {
    update({ mode });
    // Picking a type is the whole step, so move straight on.
    setSearchParams({ step: "1" });
  };

  const scheduleMessage = scheduleError(state.startDate, state.endDate);

  let body: ReactNode = null;
  switch (step) {
    case "type":
      body = (
        <>
          <h3 className="CreateLogWizard__question">What kind of log are you starting?</h3>
          <div className="CreateLogWizard__choices" role="radiogroup" aria-label="Log type">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={state.mode === option.mode}
                className={cx("CreateLogWizard__choice", {
                  "CreateLogWizard__choice--selected": state.mode === option.mode,
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
          <h3 className="CreateLogWizard__question">Give it a name</h3>
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
          <p className="CreateLogWizard__hint">
            {state.mode === "financial"
              ? "Set this to 1 to keep the log to yourself. You can invite others later if there's room."
              : "Invite friends with a link once the group is created."}
          </p>
        </>
      );
      break;

    case "schedule":
      body = (
        <>
          <h3 className="CreateLogWizard__question">When does it run?</h3>
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
          <p className="CreateLogWizard__hint">Log groups can run for up to a month.</p>
        </>
      );
      break;

    case "currency":
      body = (
        <>
          <h3 className="CreateLogWizard__question">What currency do you usually spend in?</h3>
          <div className="ControlledInput">
            <div className="ControlledInput__input">
              <label htmlFor="wizard-default-currency">Default currency</label>
              <select
                id="wizard-default-currency"
                value={state.defaultCurrency}
                onChange={(e) => update({ defaultCurrency: e.target.value as Currency })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="CreateLogWizard__hint">
            New entries start in this currency, but any entry can use a different one. Totals are
            kept per currency and never converted.
          </p>
        </>
      );
      break;

    case "review":
      body = (
        <>
          <h3 className="CreateLogWizard__question">Ready to go?</h3>
          <dl className="CreateLogWizard__review">
            <dt>Type</dt>
            <dd>{state.mode === "social" ? "Social log group" : "Financial log"}</dd>
            <dt>Title</dt>
            <dd>{state.title.trim()}</dd>
            <dt>Participants</dt>
            <dd>{state.maxParticipants === 1 ? "Just you" : `Up to ${state.maxParticipants}`}</dd>
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

  return (
    <form
      className="Window CreateNewLog CreateLogWizard"
      onSubmit={handleNext}
      onKeyDown={handleKeyDown}
      noValidate
    >
      <ol className="CreateLogWizard__progress" aria-label="Progress">
        {(state.mode ? steps : stepsFor("social")).map((s, i) => (
          <li
            key={s}
            className={cx("CreateLogWizard__progress__step", {
              "CreateLogWizard__progress__step--done": i < stepIndex,
              "CreateLogWizard__progress__step--current": i === stepIndex,
            })}
            aria-current={i === stepIndex ? "step" : undefined}
          >
            {i + 1}. {i === 2 && !state.mode ? "Details" : STEP_LABELS[s]}
          </li>
        ))}
      </ol>

      <div className="CreateLogWizard__body">{body}</div>

      <div className="Menu CreateLogWizard__actions">
        {stepIndex > 0 && (
          <Button
            text="Back"
            buttonStyle="primary-border-lite"
            disabled={isSubmitting}
            onClick={() => goTo(stepIndex - 1)}
          />
        )}
        {step !== "type" && (
          <Button
            text={
              isLast
                ? state.mode === "social"
                  ? "Start log group"
                  : "Start financial log"
                : "Next"
            }
            size={isLast ? "lg" : undefined}
            buttonStyle="primary-border"
            disabled={!canAdvance || isSubmitting || (isLast && !user?.userId)}
            loading={isLast && isSubmitting}
            onClick={() => handleNext()}
          />
        )}
      </div>
    </form>
  );
};

export default CreateLogWizard;
