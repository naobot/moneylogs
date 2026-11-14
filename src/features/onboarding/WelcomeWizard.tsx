import { ReactNode, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { deleteField } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

import { auth } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { UserData } from "@/hooks/useGetUserInfo";
import { ensurePersonalLedger } from "@/hooks/useLedgerQuery";
import { updateUserFields } from "@/hooks/useUserQuery";
import { sanitizeRedirect } from "@/features/auth/authRedirect";
import { DisplaySection } from "@/features/account/DisplaySection";
import dayjs from "@/utils/configuredDayjs";
import { ledgerStartCurrency } from "@/utils/currency";
import { personalLedgerId } from "@/utils/personalLedger";

import ControlledInput from "@/components/ControlledInput";
import CurrencySelect from "@/components/CurrencySelect";
import TimezoneSelect from "@/components/TimezoneSelect";
import Wizard from "@/components/Wizard/Wizard";

import {
  displayLocationError,
  displayNameError,
  isWelcomeStepValid,
  reachableWelcomeStep,
  WELCOME_STEP_LABELS,
  WELCOME_STEPS,
  WelcomeState,
} from "./welcomeSteps";

import "@/components/ProfileFields.scss";

const guessTimezone = (): string => {
  try {
    return dayjs.tz.guess() ?? "";
  } catch {
    return "";
  }
};

const initialState = (user: UserData): WelcomeState => ({
  displayName: user.displayName ?? "",
  displayLocation: user.displayLocation ?? "",
  timezone: user.timezone || guessTimezone(),
  defaultCurrency: ledgerStartCurrency(user),
});

/**
 * First-run setup for a new account, one question per step: name, location, timezone,
 * display, default currency. Each step is saved as you go, so a refresh resumes where you
 * were. Finishing makes your personal log in your currency and takes you there (or on to
 * the invite you signed up from).
 */
export const WelcomeWizard = () => {
  const { user } = useCurrentUser();
  // The form seeds itself from the profile, so wait until it's here.
  if (!user) return <div className="Window Wizard">...</div>;
  return <WelcomeWizardForm key={user.id} user={user} />;
};

const WelcomeWizardForm = ({ user }: { user: UserData }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const next = sanitizeRedirect(searchParams.get("next") ?? undefined);

  const [state, setState] = useState<WelcomeState>(() => initialState(user));
  const update = (patch: Partial<WelcomeState>) => setState((prev) => ({ ...prev, ...patch }));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // The step lives in the URL so a refresh resumes and the back button walks back.
  const stepIndex = reachableWelcomeStep(Number(searchParams.get("step") ?? 0), state);
  const step = WELCOME_STEPS[stepIndex];
  const isLast = stepIndex === WELCOME_STEPS.length - 1;

  const goTo = (index: number) => {
    const params: Record<string, string> = {};
    if (index > 0) params.step = String(index);
    if (next) params.next = next;
    setSearchParams(params);
  };

  /** Persist what this step asked for. Display prefs are per device and already saved. */
  const saveStep = async () => {
    switch (step) {
      case "name": {
        const displayName = state.displayName.trim();
        await updateUserFields(user.id, { displayName });
        if (auth.currentUser) await updateProfile(auth.currentUser, { displayName });
        return;
      }
      case "location":
        await updateUserFields(user.id, { displayLocation: state.displayLocation.trim() });
        return;
      case "timezone":
        await updateUserFields(user.id, { timezone: state.timezone });
        return;
      case "display":
        return;
      case "currency": {
        // The personal log first (the ensure hook stands down while onboarding is
        // pending), so it starts in the currency just picked.
        await ensurePersonalLedger({
          member: { uid: user.userId, userDocId: user.id },
          defaultCurrency: state.defaultCurrency,
        });
        await updateUserFields(user.id, {
          defaultCurrency: state.defaultCurrency,
          onboardingPending: deleteField(),
        });
        return;
      }
    }
  };

  const handleNext = async () => {
    if (!isWelcomeStepValid(step, state) || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveStep();
      if (isLast) {
        void navigate(next ?? `/l/${personalLedgerId(user.userId)}`, { replace: true });
        return;
      }
      goTo(stepIndex + 1);
    } catch (err) {
      console.error("Failed to save welcome step:", err);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  let body: ReactNode = null;
  switch (step) {
    case "name":
      body = (
        <>
          <h3 className="Wizard__question">welcome! what should we call you?</h3>
          <ControlledInput
            label="Display name"
            value={state.displayName}
            onChange={(e) => update({ displayName: e.target.value })}
            isError={!!state.displayName && !!displayNameError(state.displayName)}
            errorMessage={displayNameError(state.displayName)}
          />
          <p className="Wizard__hint">
            This is how you appear to everyone in your logs. You can change it later.
          </p>
        </>
      );
      break;

    case "location":
      body = (
        <>
          <h3 className="Wizard__question">where are you based?</h3>
          <ControlledInput
            label="Display location"
            value={state.displayLocation}
            onChange={(e) => update({ displayLocation: e.target.value })}
            isError={!!displayLocationError(state.displayLocation)}
            errorMessage={displayLocationError(state.displayLocation)}
          />
          <p className="Wizard__hint">
            Optional. Shown next to your name, e.g.{" "}
            <strong className="keep-case">
              {state.displayName.trim() || "you"} ({state.displayLocation.trim() || "Tokyo"})
            </strong>
            . Leave it blank to skip.
          </p>
        </>
      );
      break;

    case "timezone":
      body = (
        <>
          <h3 className="Wizard__question">what's your timezone?</h3>
          <TimezoneSelect
            label="My timezone is"
            value={state.timezone}
            onChange={(timezone) => update({ timezone })}
          />
          <p className="Wizard__hint">
            We guessed from this device. Posts and entries are dated in it, and travelling posts can
            still use their own.
          </p>
        </>
      );
      break;

    case "display":
      body = (
        <>
          <h3 className="Wizard__question">how should things look?</h3>
          <DisplaySection />
        </>
      );
      break;

    case "currency":
      body = (
        <>
          <h3 className="Wizard__question">what currency do you usually spend in?</h3>
          <CurrencySelect
            id="welcome-default-currency"
            label="Default currency"
            value={state.defaultCurrency}
            onChange={(defaultCurrency) => update({ defaultCurrency })}
          />
          <p className="Wizard__hint">
            Your personal log starts in it, and so do new posts until you pick another currency on
            this device. Any entry can still use a different one.
          </p>
        </>
      );
      break;
  }

  return (
    <Wizard
      className="WelcomeWizard ProfileFields"
      labels={WELCOME_STEPS.map((s) => WELCOME_STEP_LABELS[s])}
      stepIndex={stepIndex}
      onBack={() => goTo(stepIndex - 1)}
      onNext={() => void handleNext()}
      nextText={isLast ? (next ? "Finish" : "Take me to my log") : "Next"}
      nextLarge={isLast}
      nextDisabled={!isWelcomeStepValid(step, state)}
      busy={saving}
    >
      {body}
      {failed && <div className="error-message">Couldn&apos;t save that. Please try again.</div>}
    </Wizard>
  );
};

export default WelcomeWizard;
