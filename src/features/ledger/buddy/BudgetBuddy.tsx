import { useEffect, useRef, useState } from "react";
import cx from "classnames";

import dayjs from "@/utils/configuredDayjs";
import Popover from "@/components/Popover";
import { useCurrentUser } from "@/contexts";
import { isMousePointer } from "@/hooks/useHoverIntent";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { useNow } from "@/hooks/useNow";
import { Ledger } from "@/types/ledger";
import { shiftMonth, todayInTz } from "@/utils/ledger";
import { buddyMood } from "./buddyMood";
import { buddyComment } from "./buddyComments";
import { FACES } from "./faces";

import "./BudgetBuddy.scss";

/** How long the click face shows before it settles back. */
export const CLICK_FACE_MS = 1200;

const localHourIn = (now: dayjs.Dayjs, timezone?: string | null): number => {
  try {
    return (timezone ? now.tz(timezone) : now).hour();
  } catch {
    return now.hour();
  }
};

/**
 * A kaomoji cat whose face reflects how this month's spending is going. It always shows
 * the current month, whatever month is being browsed. It sleeps at night in the
 * viewer's timezone, perks up on hover, and on click says something about the month in
 * a speech bubble.
 */
export const BudgetBuddy = ({ ledger }: { ledger: Pick<Ledger, "id" | "categories"> }) => {
  const { user } = useCurrentUser();
  const now = useNow();
  const today = todayInTz(user?.timezone, now.valueOf());
  const month = today.slice(0, 7);
  const localHour = localHourIn(now, user?.timezone);

  const { byMonth, isSuccess } = useLedgerMonths({
    ledgerId: ledger.id,
    from: shiftMonth(month, -1),
    to: month,
  });

  // Cheap enough to work out on every render: two month docs and a few categories.
  const state = buddyMood({
    ledgerId: ledger.id,
    categories: ledger.categories ?? [],
    current: byMonth[month],
    previous: byMonth[shiftMonth(month, -1)],
    today,
    localHour,
  });

  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [poked, setPoked] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const clicks = useRef(0);
  const pokeTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(pokeTimer.current), []);

  // Nothing until the month docs arrive, so the face doesn't flash from idle.
  if (!isSuccess) return null;

  const faces = FACES[state.asleep ? "asleep" : state.mood];
  const face = poked
    ? faces.click
    : hovered
      ? faces.hover
      : faces.resting[state.seed % faces.resting.length];

  const poke = () => {
    clearTimeout(pokeTimer.current);
    setPoked(true);
    pokeTimer.current = setTimeout(() => setPoked(false), CLICK_FACE_MS);
    if (bubble) {
      setBubble(null);
      return;
    }
    setBubble(buddyComment(state, clicks.current));
    clicks.current += 1;
  };

  const feeling = state.asleep ? "asleep" : state.mood;

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={cx("BudgetBuddy keep-case", `BudgetBuddy--${feeling}`)}
        aria-label={`Budget buddy: ${feeling}. Click to hear how the month is going.`}
        aria-haspopup="dialog"
        aria-expanded={!!bubble}
        onPointerEnter={(e) => isMousePointer(e) && setHovered(true)}
        onPointerLeave={(e) => isMousePointer(e) && setHovered(false)}
        onClick={poke}
      >
        <span className="BudgetBuddy__face" aria-hidden="true">
          {face}
        </span>
      </button>
      <Popover
        anchor={anchor}
        open={!!bubble}
        onClose={() => setBubble(null)}
        placement="bottom"
        className="BuddyBubble"
        role="dialog"
        aria-label="Budget buddy says"
      >
        <p className="BuddyBubble__text keep-case">{bubble}</p>
      </Popover>
    </>
  );
};

export default BudgetBuddy;
