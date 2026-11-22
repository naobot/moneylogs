import { ReactNode } from "react";
import { serverTimestamp } from "firebase/firestore";
import cx from "classnames";

import Slides, { Slide, SlidesResult } from "@/components/Slides/Slides";
import { useCurrentUser } from "@/contexts";
import { updateUserFields } from "@/hooks/useUserQuery";
import { track } from "@/utils/analytics";
import { reportError } from "@/utils/reportError";
import "./sublogs.scss";

/**
 * "What's a sublog?": the idea in seven slides, each a picture made of the app's own
 * pieces and a worked example. The screens are the familiar ledger ones, so this teaches
 * the idea, not the controls (see the canvas board "intro slides" for the approved copy).
 */

/** Where the intro was opened from, for analytics. */
export type SublogIntroFrom = "wizard" | "link_form" | "visit" | "help";

// ---- picture parts -------------------------------------------------------------

const Sw = ({ slot, sublog }: { slot?: 0 | 1 | 2 | 3; sublog?: boolean }) => (
  <span
    className={cx("MiniSwatch", slot !== undefined && `chart-fill-${slot}`, {
      "MiniSwatch--sublog": sublog,
    })}
  />
);

const Row = ({
  name,
  amount,
  slot,
  sublog,
  hot,
  total,
}: {
  name: ReactNode;
  amount: ReactNode;
  slot?: 0 | 1 | 2 | 3;
  sublog?: boolean;
  hot?: boolean;
  total?: boolean;
}) => (
  <div className={cx("MiniRow", { "MiniRow--hot": hot, "MiniRow--total": total })}>
    <span className="MiniRow__name">
      {(slot !== undefined || sublog) && <Sw slot={slot} sublog={sublog} />}
      {sublog ? (
        <>
          <span className="SublogName__glyph">↳</span>
          {name} ›
        </>
      ) : (
        name
      )}
    </span>
    <span className="MiniRow__amount">{amount}</span>
  </div>
);

const Log = ({
  title,
  note,
  flush,
  children,
}: {
  title: string;
  note?: string;
  flush?: boolean;
  children: ReactNode;
}) => (
  <div className="MiniLog">
    <div className="MiniLog__head">
      <span className="keep-case">{title}</span>
      {note && <small className="keep-case">{note}</small>}
    </div>
    <div className={cx("MiniLog__body", { "MiniLog__body--flush": flush })}>{children}</div>
  </div>
);

const Down = ({ children }: { children: ReactNode }) => (
  <div className="IntroArt__flow">
    <span className="IntroArt__arrow">│▼</span>
    <span>{children}</span>
  </div>
);

const Across = ({ children }: { children: ReactNode }) => (
  <div className="IntroArt__flow IntroArt__flow--across">
    <span className="IntroArt__arrow">──►</span>
    <span>{children}</span>
  </div>
);

const Meter = ({
  name,
  used,
  label,
  open,
}: {
  name: ReactNode;
  used: number;
  label: string;
  open?: boolean;
}) => (
  <div className="MiniMeter">
    <span className="MiniRow__name">{name}</span>
    <span className={cx("MiniMeter__track", { "MiniMeter__track--open": open })}>
      <span className="MiniMeter__fill" style={{ width: `${Math.round(used * 100)}%` }} />
    </span>
    <span className="MiniRow__amount">{label}</span>
  </div>
);

const Person = ({
  initial,
  name,
  note,
  amount,
  counts,
}: {
  initial: string;
  name: string;
  note: string;
  amount: string;
  counts: boolean;
}) => (
  <div className={cx("MiniPerson", { "MiniPerson--stays": !counts })}>
    <span className="MiniPerson__face">{initial}</span>
    <span>
      {name} <span className="IntroArt__caption">{note}</span>
    </span>
    <span className="MiniPerson__amount">{amount}</span>
    <span className={cx("MiniPerson__tag", { "MiniPerson__tag--counts": counts })}>
      {counts ? "counts" : "stays"}
    </span>
  </div>
);

const Art = ({ children }: { children: ReactNode }) => (
  <div className="IntroArt" aria-hidden="true">
    {children}
  </div>
);

// ---- the slides ----------------------------------------------------------------

const SUBLOG_SLIDES: ReadonlyArray<Slide> = [
  {
    id: "feeds",
    heading: "one log can feed another",
    art: (
      <Art>
        <div className="IntroArt__row">
          <Log title="business" note="nov">
            <Row name="software" amount="$210" slot={0} />
            <Row name="travel" amount="$150" slot={1} />
            <Row name="supplies" amount="$70" slot={2} />
            <Row name="total" amount={<b>$430</b>} total />
          </Log>
          <Across>
            counts as
            <br />
            one line
          </Across>
          <Log title="personal" note="nov">
            <Row name="housing" amount="$1,450" slot={0} />
            <Row name="food" amount="$612" slot={1} />
            <Row name="business" amount={<b>$430</b>} slot={2} sublog hot />
            <Row name="transport" amount="$188" slot={3} />
          </Log>
        </div>
        <span className="IntroArt__caption">
          The box inside a box marks a line that is another log.
        </span>
      </Art>
    ),
    text: "A sublog is an ordinary log whose spending also counts as one category in another log, its parent.",
    example: (
      <>
        <b>For example:</b> Mia freelances on the side. Her business log has its own categories. In
        her personal log, all of it is one line: business, $430.
      </>
    ),
  },
  {
    id: "log-it-there",
    heading: "log it where it happens",
    art: (
      <Art>
        <span className="IntroArt__caption">
          in <b className="keep-case">business</b>
        </span>
        <div className="MiniEntry">
          <b>$42</b>
          <span>software</span>
          <span className="IntroArt__caption">domain renewal</span>
          <span className="MiniEntry__button">add</span>
        </div>
        <Down>the day's total shows in personal</Down>
        <span className="IntroArt__caption">
          in <b className="keep-case">personal</b>
        </span>
        <div>
          <div className="MiniDay">
            <span>fri 21 nov</span>
            <span>$88</span>
          </div>
          <div className="MiniRow" style={{ padding: "0.2em 0.5em", background: "var(--sheet)" }}>
            <span className="MiniRow__name">
              food <small>groceries</small>
            </span>
            <span className="MiniRow__amount">$46</span>
          </div>
          <div className="MiniSublogRow">
            <span className="MiniRow__name">
              <Sw sublog />
              <span className="SublogName__glyph">↳</span>business
            </span>
            <small>1 entry</small>
            <span className="MiniRow__amount">
              <b>$42</b> ›
            </span>
          </div>
        </div>
      </Art>
    ),
    text: "Add business spending in the business log, with its own categories. Personal shows the total as a single line, and that line opens the sublog.",
    example: (
      <>
        <b>For example:</b> Mia renews a domain for $42. She adds it in business, under software.
        Her personal log&apos;s day shows one row, business $42, with no copy of the entry to keep
        in step.
      </>
    ),
  },
  {
    id: "budgets",
    heading: "budget the line, plan the detail",
    art: (
      <Art>
        <Log title="personal" note="budget">
          <Meter
            name={
              <>
                <Sw sublog />
                <span className="SublogName__glyph">↳</span>business
              </>
            }
            used={0.86}
            label="430 / 500"
          />
        </Log>
        <Down>inside business, split it your way</Down>
        <Log title="business" note="budget">
          <Meter name="software" used={0.7} label="210 / 300" />
          <Meter name="travel" used={0.75} label="150 / 200" />
          <Meter name="supplies" used={0.16} label="70" open />
        </Log>
      </Art>
    ),
    text: "Give business a budget in personal, like any other category. Inside business, budget its own categories if you want to. The two don’t have to add up.",
    example: (
      <>
        <b>For example:</b> Mia allows business $500 a month in personal. Inside business she sets
        $300 for software and $200 for travel, and leaves supplies open.
      </>
    ),
  },
  {
    id: "shared",
    heading: "shared sublogs",
    art: (
      <Art>
        <Log title="bali 2026" note="Alice · Sam · Kai" flush>
          <Person initial="A" name="Alice" note="in personal too" amount="$820" counts />
          <Person initial="S" name="Sam" note="trip only" amount="$640" counts={false} />
          <Person initial="K" name="Kai" note="trip only" amount="$510" counts={false} />
        </Log>
        <Down>only Alice is in both logs, so only her $820 counts</Down>
        <Log title="personal" note="Alice · nov">
          <Row name="housing" amount="$1,450" slot={0} />
          <Row name="food" amount="$612" slot={1} />
          <Row name="bali" amount={<b>$820</b>} slot={2} sublog hot />
        </Log>
        <span className="IntroArt__caption">
          A sublog has one parent. Sam&apos;s and Kai&apos;s spending stays in the trip.
        </span>
      </Art>
    ),
    text: "When a sublog is shared, only spending by people who are in both logs counts in the parent. A trip with friends adds just your share to your personal log.",
    example: (
      <>
        <b>For example:</b> Alice, Sam and Kai log bali 2026 together. Alice links it to her
        personal log, so her $820 counts there and the trip&apos;s other spending doesn&apos;t.
      </>
    ),
  },
  {
    id: "household",
    heading: "a shared household",
    art: (
      <Art>
        <Log title="childcare" note="Alex · Jo · nov" flush>
          <Person initial="A" name="Alex" note="daycare, sitter" amount="$640" counts />
          <Person initial="J" name="Jo" note="daycare, supplies" amount="$580" counts />
        </Log>
        <Down>both are in both logs, so both count: $640 + $580</Down>
        <Log title="household" note="Alex · Jo · nov">
          <Row name="rent" amount="$2,100" slot={0} />
          <Row name="groceries" amount="$740" slot={1} />
          <Row name="childcare" amount={<b>$1,220</b>} slot={2} sublog hot />
        </Log>
        <div className="MiniNotice">
          <span>
            <b>Jo&apos;s inbox:</b> Alex linked childcare to household ·{" "}
            <span className="IntroArt__caption">
              it shows there as one line, childcare, which everyone in household can see
            </span>
          </span>
        </div>
      </Art>
    ),
    text: "When the same people share both logs, everyone's spending counts. And whenever someone's spending starts counting in another log, they're told.",
    example: (
      <>
        <b>For example:</b> Alex and Jo run their household together. Childcare gets its own log for
        daycare, sitters and supplies. In household it&apos;s one line, with both their spending.
      </>
    ),
  },
  {
    id: "ideas",
    heading: "some ideas",
    art: (
      <Art>
        <div className="MiniTree">
          <div className="MiniTree__parent">
            <span className="keep-case">personal</span>
            <small>everyday spending</small>
          </div>
          <div className="MiniTree__kids">
            <div className="MiniTree__kid">
              <strong>↳ business</strong>
              <span>a side business, its tools and travel</span>
            </div>
            <div className="MiniTree__kid">
              <strong>↳ pip the cat</strong>
              <span>food, vet visits, the odd toy</span>
            </div>
            <div className="MiniTree__kid">
              <strong>↳ bali 2026</strong>
              <span>every detail while away, one line once home</span>
            </div>
          </div>
          <div className="MiniTree__parent">
            <span className="keep-case">household</span>
            <small>shared with a partner</small>
          </div>
          <div className="MiniTree__kids">
            <div className="MiniTree__kid">
              <strong>↳ childcare</strong>
              <span>daycare, sitters, supplies</span>
            </div>
            <div className="MiniTree__kid">
              <strong>↳ renovation</strong>
              <span>a project with its own budget</span>
            </div>
          </div>
        </div>
      </Art>
    ),
    text: "A side business. Childcare or a pet you want to see on their own. A trip, where you want every detail while you’re away and one line once you’re home.",
  },
  {
    id: "start",
    heading: "start one",
    art: (
      <Art>
        <span className="IntroArt__caption">a new log: the "part of another log?" step</span>
        <div className="MiniChoice">
          <b>no, it stands alone</b>
        </div>
        <div className="MiniChoice MiniChoice--on">
          <b className="keep-case">personal</b>
          <small>just you</small>
        </div>
        <div className="MiniChoice">
          <b className="keep-case">household</b>
          <small>shared with 1 other</small>
        </div>
        <span className="IntroArt__caption">
          a log you already keep: manage › part of another log
        </span>
        <div className="MiniEntry">
          <span>part of</span>
          <b className="keep-case">personal</b>
          <span className="IntroArt__caption">from this month on</span>
          <span className="MiniEntry__button">link</span>
        </div>
      </Art>
    ),
    text: "Make a new log and pick its parent on the “part of another log?” step, or link a log you already have from its log actions. You can unlink at any time; past months keep their totals.",
  },
];

// ---- the window ----------------------------------------------------------------

/**
 * The intro window. Closing it, read or skipped, records that it's been seen
 * (users.tutorials.sublogIntro), so it never opens by itself again on any device.
 * `onStart` adds a "start a sublog" button at the end, for places that aren't already
 * mid-way through making one.
 */
export const SublogIntro = ({
  isOpen,
  from,
  onClose,
  onStart,
}: {
  isOpen: boolean;
  from: SublogIntroFrom;
  onClose: () => void;
  onStart?: () => void;
}) => {
  const { user } = useCurrentUser();

  const close = (result: SlidesResult) => {
    track("sublog_intro", { from, result });
    if (user && !user.tutorials?.sublogIntro) {
      updateUserFields(user.id, { "tutorials.sublogIntro": serverTimestamp() }).catch(
        (err: unknown) =>
          reportError(err, { feature: "sublogs", action: "record_intro", level: "warning" }),
      );
    }
    onClose();
  };

  return (
    <Slides
      isOpen={isOpen}
      title="what's a sublog?"
      slides={SUBLOG_SLIDES}
      onClose={close}
      action={onStart ? { text: "Start a sublog", onClick: onStart } : undefined}
    />
  );
};

export default SublogIntro;
