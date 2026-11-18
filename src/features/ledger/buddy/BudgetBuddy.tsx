import { useEffect, useRef, useState } from "react";
import cx from "classnames";

import dayjs from "@/utils/configuredDayjs";
import Icon from "@/components/Icon";
import Popover from "@/components/Popover";
import { useCurrentUser } from "@/contexts";
import { isMousePointer, useHoverIntent } from "@/hooks/useHoverIntent";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { useNoSpendDays } from "@/hooks/useNoSpendDays";
import { useNow } from "@/hooks/useNow";
import { Ledger } from "@/types/ledger";
import { shiftMonth, todayInTz } from "@/utils/ledger";
import { buddyMood } from "./buddyMood";
import {
  buddyCheckInComment,
  buddyComment,
  buddyFindTeaser,
  buddyNoSpendComment,
} from "./buddyComments";
import { checkedInToday, CheckIn, eveningCheckIn, markCheckedIn } from "./buddyCheckIn";
import { ASLEEP_HOVER_FACE, FACES, HOVER_FACES, pick } from "./faces";
import KnickKnackReveal from "./knickknacks/KnickKnackReveal";
import { KnickKnackFind, useUnseenFind } from "./knickknacks/useUnseenFinds";
import { cheeredNoSpend, markCheeredNoSpend } from "@/features/ledger/noSpend/noSpendDays";

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
 * - When it has a knick-knack from this log to show (a seasonal find, or a coin), a "!"
 *   shows beside it. A click opens a teaser bubble; clicking that opens the reveal
 *   pop-up, which completes it. Everything else waits in the dashboard's drawer.
 */
export const BudgetBuddy = ({ ledger }: { ledger: Pick<Ledger, "id" | "categories"> }) => {
  const { user } = useCurrentUser();
  const find = useUnseenFind(user?.id, ledger.id);
  const now = useNow();
  const today = todayInTz(user?.timezone, now.valueOf());
  const month = today.slice(0, 7);
  const localHour = localHourIn(now, user?.timezone);

  const previousMonth = shiftMonth(month, -1);
  const { byMonth, isSuccess: monthsLoaded } = useLedgerMonths({
    ledgerId: ledger.id,
    from: previousMonth,
    to: month,
  });

  // Only confirmed days count as no-spend: an unlogged day may just have been forgotten.
  const noSpend = useNoSpendDays();
  const confirmedToday = noSpend.days.has(today);
  // Both have to be in before it speaks up: without the no-spend days, an already
  // confirmed day looks unconfirmed, and the check-in asks again (using up today's).
  const isSuccess = monthsLoaded && noSpend.isSuccess;

  // Cheap enough to work out on every render: two month docs and a few categories.
  const state = buddyMood({
    ledgerId: ledger.id,
    categories: ledger.categories ?? [],
    current: byMonth[month],
    previous: byMonth[previousMonth],
    today,
    localHour,
    confirmedNoSpend: noSpend.days,
  });
  const evening = eveningCheckIn({
    today,
    localHour,
    current: byMonth[month],
    previous: byMonth[previousMonth],
  });
  // The "quiet" check-in asks whether today was a no-spend day; once it's confirmed, the
  // cheer below says so instead.
  const checkIn = evening === "quiet" && confirmedToday ? null : evening;

  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [hoverFace, setHoverFace] = useState<string | null>(null);
  // The face is set when the bubble speaks for itself; clicks use the mood's click face.
  // `teaser` is set when it's saying it has a find to show.
  const [bubble, setBubble] = useState<{
    text: string;
    face?: string;
    teaser?: boolean;
  } | null>(null);
  // The find in the reveal pop-up, held so it stays put while seenAt lands.
  const [revealing, setRevealing] = useState<KnickKnackFind | null>(null);
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

  // Cheer a confirmed no-spend day, once a day whichever log it's in. It takes over an
  // open bubble: the person has just told it something worth celebrating.
  const cheered = useRef<string | null>(null);
  useEffect(() => {
    if (!isSuccess || !anchor || !confirmedToday) return;
    if (cheered.current === today || cheeredNoSpend(today)) return;
    cheered.current = today;
    markCheeredNoSpend(today);
    setBubble({
      text: buddyNoSpendComment({ asleep, seed }),
      face: pick(FACES.delighted.click, seed),
    });
  }, [isSuccess, anchor, confirmedToday, today, asleep, seed]);

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
    if (find) {
      setBubble({
        text: buddyFindTeaser(state),
        face: pick(FACES.delighted.click, state.seed),
        teaser: true,
      });
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
          find && !revealing
            ? "Budget buddy found something! Click to hear about it."
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
        {find && !revealing && (
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
        className={cx("BuddyBubble", { "BuddyBubble--find": bubble?.teaser })}
        role="dialog"
        aria-label="Budget buddy says"
      >
        {bubble?.teaser && find ? (
          <button
            type="button"
            className="BuddyBubble__teaser BuddyBubble__text keep-case"
            onClick={() => {
              setBubble(null);
              setRevealing(find);
            }}
          >
            {bubble.text}
          </button>
        ) : (
          <p className="BuddyBubble__text keep-case">{bubble?.text}</p>
        )}
      </Popover>
      {revealing && user?.id && (
        <KnickKnackReveal userDocId={user.id} find={revealing} onClose={() => setRevealing(null)} />
      )}
    </>
  );
};

export default BudgetBuddy;
