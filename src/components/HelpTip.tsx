import { ReactNode, useId, useState } from "react";

import { isMousePointer, useHoverIntent } from "@/hooks/useHoverIntent";
import Icon from "./Icon";
import Popover from "./Popover";

import "./HelpTip.scss";

/**
 * A small "?" that explains the thing beside it. Opens on hover (after a beat), on
 * keyboard focus, and on tap; closes on leave, blur (tapping away) or Escape.
 */
export const HelpTip = ({ label, children }: { label: string; children: ReactNode }) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const { openAfterDelay, cancelOpen } = useHoverIntent();
  const id = useId();

  const close = () => {
    cancelOpen();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="HelpTip"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onPointerEnter={(e) => isMousePointer(e) && openAfterDelay(() => setOpen(true))}
        onPointerLeave={(e) => isMousePointer(e) && close()}
        onFocus={() => setOpen(true)}
        onBlur={close}
        // A tap focuses (which opens) then clicks: keep it open. Tapping away blurs it.
        onClick={() => {
          cancelOpen();
          setOpen(true);
        }}
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <Icon type="question" size={16} />
      </button>
      <Popover
        anchor={anchor}
        open={open}
        onClose={close}
        interactive={false}
        className="HelpTip__panel"
        role="tooltip"
      >
        <p id={id} className="HelpTip__text">
          {children}
        </p>
      </Popover>
    </>
  );
};

export default HelpTip;
