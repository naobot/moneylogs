import { useState } from "react";

import Popover from "@/components/Popover";
import { track } from "@/utils/analytics";
import { reportError } from "@/utils/reportError";

import { Nudge, nudgeSummary } from "./nudges";
import { dismissNudge } from "./nudgeStore";

import "./Nudges.scss";

type NudgeBubbleProps = { nudge: Nudge; name: string };

/**
 * A friend poked or cheered you: a bouncing "!" over their avatar. Tapping it opens a
 * speech bubble with what they sent; once it's closed, it's gone for good.
 */
export const NudgeBubble = ({ nudge, name }: NudgeBubbleProps) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  // What was opened, kept as it was: a new poke arriving while it's open shows next time.
  const [shown, setShown] = useState<Nudge | null>(null);

  const close = () => {
    if (!shown) return;
    setShown(null);
    void dismissNudge(shown).catch((err: unknown) =>
      reportError(err, { feature: "friends", action: "dismiss_nudge", level: "warning" }),
    );
  };

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="NudgeBubble__alert"
        aria-label={`${name} sent you something`}
        aria-expanded={!!shown}
        onClick={() => {
          if (shown) return close();
          setShown(nudge);
          track("read_nudge");
        }}
      >
        !
      </button>
      <Popover
        anchor={anchor}
        open={!!shown}
        onClose={close}
        placement="bottom"
        align="start"
        role="dialog"
        aria-label={`From ${name}`}
        className="NudgeBubble"
      >
        <p className="NudgeBubble__text">
          <strong className="keep-case">{name}</strong> {shown && nudgeSummary(shown)}
        </p>
        <button type="button" className="NudgeBubble__close" aria-label="Close" onClick={close}>
          ×
        </button>
      </Popover>
    </>
  );
};

export default NudgeBubble;
