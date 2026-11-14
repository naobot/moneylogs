import { FormEvent, KeyboardEvent, ReactNode } from "react";
import cx from "classnames";

import Button from "@/components/Button";

import "./Wizard.scss";

type WizardProps = {
  /** Extra classes for the flow, e.g. "CreateLogWizard". */
  className?: string;
  /** Progress labels, in order. */
  labels: string[];
  stepIndex: number;
  children: ReactNode;
  /** Back is shown from the second step on. */
  onBack: () => void;
  /** Called by the Next button, by Enter in a text input, and by form submit. */
  onNext: () => void;
  /** Hide Next on steps that advance themselves (e.g. picking a card). */
  showNext?: boolean;
  nextText: string;
  nextLarge?: boolean;
  nextDisabled?: boolean;
  busy?: boolean;
};

/**
 * A step-by-step form: progress list, the current step's body, and Back/Next. The
 * flow owns its steps and state (usually with the step index in the URL, so the
 * browser back button walks back through it); this owns the chrome and keyboard.
 */
export const Wizard = ({
  className,
  labels,
  stepIndex,
  children,
  onBack,
  onNext,
  showNext = true,
  nextText,
  nextLarge,
  nextDisabled,
  busy,
}: WizardProps) => {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nextDisabled && !busy) onNext();
  };

  // Enter in a text/number/date input advances, without relying on implicit form
  // submission (inconsistent across browsers when there's no visible submit button).
  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (!(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (showNext && !nextDisabled && !busy) onNext();
  };

  return (
    <form
      className={cx("Window Wizard", className)}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      noValidate
    >
      <ol className="Wizard__progress" aria-label="Progress">
        {labels.map((label, i) => (
          <li
            key={`${i}-${label}`}
            className={cx("Wizard__progress__step", {
              "Wizard__progress__step--done": i < stepIndex,
              "Wizard__progress__step--current": i === stepIndex,
            })}
            aria-current={i === stepIndex ? "step" : undefined}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="Wizard__body">{children}</div>

      <div className="Menu Wizard__actions">
        {stepIndex > 0 && (
          <Button text="Back" buttonStyle="primary-border-lite" disabled={busy} onClick={onBack} />
        )}
        {showNext && (
          <Button
            text={nextText}
            size={nextLarge ? "lg" : undefined}
            buttonStyle="primary-border"
            disabled={nextDisabled || busy}
            loading={busy}
            onClick={onNext}
          />
        )}
      </div>
    </form>
  );
};

export default Wizard;
