import { useState } from "react";

import Popover from "@/components/Popover";
import RowButton from "@/components/RowButton";
import { useToastContext } from "@/hooks/useToastContext";

import { CHEERS } from "./cheers";
import { useSendNudge } from "./useSendNudge";

import "./Nudges.scss";

type NudgeActionsProps = {
  userDocId: string;
  /** The friend's auth uid (from useFriendships().uidOf); null hides the actions. */
  toUid: string | null;
  name: string;
  /** Called once a cheer has been picked (e.g. to close a surrounding menu). */
  onCheered?: () => void;
  /**
   * List the cheers in place rather than in a popover: for when the actions already sit
   * in one (a popover inside a popover would close the outer one on every tap).
   */
  inline?: boolean;
};

/**
 * Poke a friend (mash away: taps are sent together) or pick some words of encouragement
 * from the presets. One tap sends; there's nothing to confirm.
 */
export const NudgeActions = ({
  userDocId,
  toUid,
  name,
  onCheered,
  inline = false,
}: NudgeActionsProps) => {
  const { poke, cheer, sent, canSend } = useSendNudge(userDocId, toUid);
  const { showToast } = useToastContext();
  const [cheerAnchor, setCheerAnchor] = useState<HTMLSpanElement | null>(null);
  const [cheersOpen, setCheersOpen] = useState(false);

  if (!canSend) return null;

  const cheerList = CHEERS.map((c) => (
    <button
      key={c.key}
      type="button"
      role="menuitem"
      className="NudgeActions__cheer"
      onClick={() => {
        setCheersOpen(false);
        void cheer(c.key);
        showToast(`Sent to ${name}: “${c.text}”`, "success");
        onCheered?.();
      }}
    >
      {c.text}
    </button>
  ));

  return (
    <div className="NudgeActions">
      <div className="NudgeActions__buttons">
        <RowButton onClick={poke} aria-label={`Poke ${name}`}>
          {sent > 0 ? `poked ×${sent}` : "poke"}
        </RowButton>
        {/* RowButton doesn't take a ref, so the popover anchors on this wrapper. */}
        <span ref={setCheerAnchor} className="NudgeActions__anchor">
          <RowButton
            aria-haspopup="menu"
            aria-expanded={cheersOpen}
            onClick={() => setCheersOpen((open) => !open)}
          >
            cheer {cheersOpen ? "▴" : "▾"}
          </RowButton>
        </span>
      </div>
      {inline ? (
        cheersOpen && (
          <div role="menu" aria-label={`Cheer ${name} on`} className="NudgeActions__cheers">
            {cheerList}
          </div>
        )
      ) : (
        <Popover
          anchor={cheerAnchor}
          open={cheersOpen}
          onClose={() => setCheersOpen(false)}
          placement="bottom"
          align="start"
          role="menu"
          aria-label={`Cheer ${name} on`}
          className="NudgeActions__cheers"
        >
          {cheerList}
        </Popover>
      )}
    </div>
  );
};

export default NudgeActions;
