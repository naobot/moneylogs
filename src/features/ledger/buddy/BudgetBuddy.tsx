import { useEffect, useRef, useState } from "react";
import cx from "classnames";

import dayjs from "@/utils/configuredDayjs";
import Icon from "@/components/Icon";
import Popover from "@/components/Popover";
import { useCurrentUser } from "@/contexts";
import { isMousePointer, useHoverIntent } from "@/hooks/useHoverIntent";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { useNow } from "@/hooks/useNow";
import { Ledger } from "@/types/ledger";
import { shiftMonth, todayInTz } from "@/utils/ledger";
import { buddyMood } from "./buddyMood";
import { buddyCheckInComment, buddyComment, buddyFindComment } from "./buddyComments";
import { checkedInToday, CheckIn, eveningCheckIn, markCheckedIn } from "./buddyCheckIn";
import { ASLEEP_HOVER_FACE, FACES, HOVER_FACES, pick } from "./faces";
import { KnickKnackId } from "./knickknacks/catalog";
import KnickKnack from "./knickknacks/KnickKnack";
import { requestQuietDayRoll } from "./knickknacks/quietDay";
import { markFindSeen, useUnseenFind } from "./knickknacks/useUnseenFinds";

import "./BudgetBuddy.scss";

/** Cheerful faces for the evening check-in. */
const CHECK_IN_FACES: Record<CheckIn, readonly string[]> = {
  quiet: FACES.happy.click,
  light: FACES.delighted.click,
};

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
 * - In the evening it speaks up by itself, once a day per log, to cheer on a day with
 *   nothing spent yet or one well under the usual.
 * - When it has found a knick-knack (rolled by the server when an entry is logged, or
 *   on a quiet evening with nothing logged), a "!" shows beside it. The next click shows the find in an inverted bubble.
 */
export const BudgetBuddy = ({ ledger }: { ledger: Pick<Ledger, "id" | "categories"> }) => {
  const { user } = useCurrentUser();
  const find = useUnseenFind(user?.id);
  const now = useNow();
  const today = todayInTz(user?.timezone, now.valueOf());
  const month = today.slice(0, 7);
  const localHour = localHourIn(now, user?.timezone);

  const previousMonth = shiftMonth(month, -1);
  const { byMonth, isSuccess } = useLedgerMonths({
    ledgerId: ledger.id,
    from: previousMonth,
    to: month,
  });

  // Cheap enough to work out on every render: two month docs and a few categories.
  const state = buddyMood({
    ledgerId: ledger.id,
    categories: ledger.categories ?? [],
    current: byMonth[month],
    previous: byMonth[previousMonth],
    today,
    localHour,
  });
  const checkIn = eveningCheckIn({
    today,
    localHour,
    current: byMonth[month],
    previous: byMonth[previousMonth],
  });

  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [hoverFace, setHoverFace] = useState<string | null>(null);
  // The face is set when the bubble speaks for itself; clicks use the mood's click face.
  // `find` is set when it's showing off a knick-knack.
  const [bubble, setBubble] = useState<{
    text: string;
    face?: string;
    find?: KnickKnackId;
  } | null>(null);
  const hovers = useRef(0);
  const clicks = useRef(0);
  const { openAfterDelay, cancelOpen } = useHoverIntent({ openDelay: BUDDY_HOVER_DELAY });

  // Speak up unprompted, once a day per log. The ref covers storage being unavailable.
  const checkedIn = useRef<string | null>(null);
  const { asleep, seed } = state;
  useEffect(() => {
    if (!isSuccess || !anchor || !checkIn) return;
    const key = `${ledger.id}:${today}`;
    if (checkedIn.current === key || checkedInToday(ledger.id, today)) return;
    checkedIn.current = key;
    markCheckedIn(ledger.id, today);
    // If a bubble is already open, the user is talking to it already: leave it be.
    setBubble(
      (open) =>
        open ?? {
          text: buddyCheckInComment(checkIn, { asleep, seed }),
          face: pick(CHECK_IN_FACES[checkIn], seed),
        },
    );
  }, [isSuccess, anchor, checkIn, ledger.id, today, asleep, seed]);

  // A quiet evening still earns the day's knick-knack roll (logging an entry is the
  // other way). The server decides whether the day's roll is still there.
  const userDocId = user?.id;
  useEffect(() => {
    if (!isSuccess || checkIn !== "quiet" || !userDocId) return;
    requestQuietDayRoll({ userDocId, ledgerId: ledger.id, today });
  }, [isSuccess, checkIn, userDocId, ledger.id, today]);

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
  const face = bubble ? (bubble.face ?? clicked) : (hoverFace ?? resting);

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
    if (find && user) {
      setBubble({
        text: buddyFindComment(find.item, state),
        face: pick(FACES.delighted.click, state.seed),
        find: find.item,
      });
      // The "!" goes once the live query hears back; the bubble stays open meanwhile.
      markFindSeen(user.id, find.id).catch((error) =>
        console.error("Failed to mark the buddy's find seen:", error),
      );
      return;
    }
    setBubble({ text: buddyComment(state, clicks.current) });
    clicks.current += 1;
  };

  const feeling = state.asleep ? "asleep" : state.mood;

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={cx("BudgetBuddy keep-case", `BudgetBuddy--${feeling}`)}
        aria-label={
          find && !bubble
            ? "Budget buddy found something! Click to see."
            : `Budget buddy: ${feeling}. Click to hear how the month is going.`
        }
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
        {find && !bubble?.find && (
          <span className="BudgetBuddy__found" aria-hidden="true">
            <Icon type="warning" size={14} />
          </span>
        )}
      </button>
      <Popover
        anchor={anchor}
        open={!!bubble}
        onClose={() => setBubble(null)}
        placement="bottom"
        className={cx("BuddyBubble", { "BuddyBubble--find": bubble?.find })}
        role="dialog"
        aria-label="Budget buddy says"
      >
        {bubble?.find ? (
          <div className="BuddyBubble__find">
            <KnickKnack id={bubble.find} size={64} />
            <p className="BuddyBubble__text keep-case">{bubble.text}</p>
          </div>
        ) : (
          <p className="BuddyBubble__text keep-case">{bubble?.text}</p>
        )}
      </Popover>
    </>
  );
};

export default BudgetBuddy;
