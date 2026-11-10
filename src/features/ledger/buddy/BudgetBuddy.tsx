import { useRef, useState } from "react";
import cx from "classnames";

import dayjs from "@/utils/configuredDayjs";
import Popover from "@/components/Popover";
import { useCurrentUser } from "@/contexts";
import { isMousePointer, useHoverIntent } from "@/hooks/useHoverIntent";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { useNow } from "@/hooks/useNow";
import { Ledger } from "@/types/ledger";
import { shiftMonth, todayInTz } from "@/utils/ledger";
import { buddyMood } from "./buddyMood";
import { buddyComment } from "./buddyComments";
import { ASLEEP_HOVER_FACE, FACES, HOVER_FACES, pick } from "./faces";

import "./BudgetBuddy.scss";

/** How long the pointer has to linger before the cat notices it. */
export const BUDDY_HOVER_DELAY = 700;

const localHourIn = (now: dayjs.Dayjs, timezone?: string | null): number => {
  try {
    return (timezone ? now.tz(timezone) : now).hour();
  } catch {
    return now.hour();
  }
};

/**
 * A kaomoji cat whose face reflects how this month's spending is going. It always shows
 * the current month, whatever month is being browsed.
 * - It sleeps at night in the viewer's timezone.
 * - Lingering over it with a mouse makes it notice you (ﾆｬｰ).
 * - A click opens a speech bubble with a comment on the month. Its face holds still
 *   until the bubble closes.
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
  const [hoverFace, setHoverFace] = useState<string | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const hovers = useRef(0);
  const clicks = useRef(0);
  const { openAfterDelay, cancelOpen } = useHoverIntent({ openDelay: BUDDY_HOVER_DELAY });

  // Nothing until the month docs arrive, so the face doesn't flash from idle.
  if (!isSuccess) return null;

  const faces = FACES[state.asleep ? "asleep" : state.mood];
  const resting = pick(faces.resting, state.seed);
  // A click face that differs from the resting one, so the click visibly lands (some
  // faces appear in both lists).
  const clicked =
    faces.click.find((f, i) => f !== resting && i >= state.seed % faces.click.length) ??
    faces.click.find((f) => f !== resting) ??
    faces.click[0];
  // While the bubble is open, it keeps the face it reacted with.
  const face = bubble ? clicked : (hoverFace ?? resting);

  const notice = () => {
    if (bubble) return;
    openAfterDelay(() => {
      setHoverFace(state.asleep ? ASLEEP_HOVER_FACE : pick(HOVER_FACES, hovers.current));
      hovers.current += 1;
    });
  };

  const ignore = () => {
    cancelOpen();
    setHoverFace(null);
  };

  const poke = () => {
    cancelOpen();
    setHoverFace(null);
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
        onPointerEnter={(e) => isMousePointer(e) && notice()}
        onPointerLeave={(e) => isMousePointer(e) && ignore()}
        onClick={poke}
      >
        {/* Keyed by face, so each new expression bounces once as it appears. */}
        <span
          key={face}
          className={cx("BudgetBuddy__face", { "BudgetBuddy__face--react": face !== resting })}
          aria-hidden="true"
        >
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
