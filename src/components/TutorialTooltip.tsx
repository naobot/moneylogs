import { MouseEvent } from "react";
import cx from "classnames";

type Props = {
  text: string;
  onDismiss: () => void;
  position?: "top" | "bottom" | "center";
  /** Pin to an edge of the anchor instead of centring (for anchors at a screen edge). */
  align?: "center" | "start" | "end";
  /** e.g. "2/9", for multi-step tours. */
  progress?: string;
  /** The small line under the text. */
  hint?: string;
  /** Shows a "skip tour" control that ends the whole tour. */
  onSkip?: () => void;
};

const TutorialTooltip = ({
  text,
  onDismiss,
  position = "bottom",
  align = "center",
  progress,
  hint = "tap to dismiss",
  onSkip,
}: Props) => {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDismiss();
  };

  const handleSkip = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSkip?.();
  };

  return (
    <div
      className={cx("TutorialTooltip", `TutorialTooltip--${position}`, {
        [`TutorialTooltip--${align}`]: align !== "center",
      })}
      onClick={handleClick}
      role="tooltip"
    >
      <span>{text}</span>
      <small>
        {progress && <>{progress} · </>}
        {hint}
        {onSkip && (
          <>
            {" · "}
            <button type="button" className="TutorialTooltip__skip" onClick={handleSkip}>
              skip tour
            </button>
          </>
        )}
      </small>
    </div>
  );
};

export default TutorialTooltip;
