import { Link, useLocation } from "react-router-dom";

import Button from "@/components/Button";
import TryAsGuest from "@/features/auth/components/TryAsGuest";
import { EXTERNAL_LINKS } from "@/config/links";
import { IconText } from "@/components/Icon";
import { LogCard } from "@/features/dashboard/LogCard";
import type { AuthLocationState } from "@/features/auth/authRedirect";

import {
  HOW_IT_WORKS,
  SAMPLE_DAY,
  SAMPLE_LEDGER,
  SAMPLE_NOW,
  SAMPLE_POSTS,
  SAMPLE_RECENT,
  SAMPLE_TRIP_TITLE,
  SAMPLE_UPCOMING,
  SampleCard,
  TRACKING,
  WITH_FRIENDS,
} from "./landingSamples";
import { LedgerPreview } from "./LedgerPreview";

import "@/features/dashboard/Dashboard.scss";
import "@/features/moneylog/components/LogPosts/PostReactions.scss";
import "./Landing.scss";

/** Which invite link brought a logged-out visitor here, if any. */
export type InviteKind = "friend" | "log" | "ledger";

export const INVITE_MESSAGES: Record<InviteKind, string> = {
  friend: "You've been invited to be friends on moneylogs.",
  log: "You've been invited to a group log.",
  ledger: "You've been invited to a shared log.",
};

/** A fixed sign-up prompt for visitors who arrived from an invite link. */
const InviteBar = ({
  invite,
  register,
  login,
}: {
  invite: InviteKind;
  register: AuthLocationState;
  login: AuthLocationState;
}) => (
  <aside className="Landing__invite" aria-label="Invitation">
    <p className="Landing__invite__text">{INVITE_MESSAGES[invite]}</p>
    <div className="Landing__invite__actions">
      <Button to="/login" state={register} text="Create an account" size="sm" />
      <Link to="/login" state={login} className="Landing__invite__login">
        or sign in
      </Link>
    </div>
  </aside>
);

/** A striped window frame around one example screen (S11 redraws these). */
const PreviewWindow = ({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
}) => (
  <section className="Landing__window" aria-label={label}>
    <div className="Landing__window__header">
      <h2 className="Landing__window__title">{title}</h2>
      <span className="Landing__window__fill tex-stripe" aria-hidden="true" />
      <span className="Landing__window__tag">example</span>
    </div>
    <div className="Landing__window__body">{children}</div>
  </section>
);

const SampleCards = ({
  cards,
  size,
  register,
}: {
  cards: SampleCard[];
  size: "large" | "small" | "compact";
  register: AuthLocationState;
}) =>
  cards.map((card) => (
    <LogCard
      key={card.title}
      to="/login"
      state={register}
      size={size}
      title={card.title}
      kind={card.kind}
      details={card.details}
      badge={card.badge}
    />
  ));

/** A grid of short titled points under a heading, the landing page's feature lists. */
const Points = ({
  id,
  heading,
  points,
  children,
}: {
  id: string;
  heading: string;
  points: { title: string; text: string }[];
  children?: React.ReactNode;
}) => (
  <section className="Landing__steps Landing__steps--points" aria-labelledby={id}>
    <h2 id={id}>{heading}</h2>
    <ul>
      {points.map((point) => (
        <li key={point.title}>
          <h3>{point.title}</h3>
          <p>{point.text}</p>
        </li>
      ))}
    </ul>
    {children}
  </section>
);

/**
 * What a logged-out visitor sees at `/`: a short pitch for everyday spending tracking, Home
 * as it looks with a few logs (built from the real dashboard cards, filled with made-up logs),
 * the tracking features with a peek inside a personal financial log, the optional social side
 * with a peek inside a group trip log, and how it works. Every example links to registration.
 *
 * Invite routes show it to logged-out visitors too (`invite` set), at the invite URL itself:
 * a fixed bar offers sign-up, and every auth link carries the invite path as `from` so the
 * visitor lands back on the invite once they've registered or signed in.
 */
export const Landing = ({ invite }: { invite?: InviteKind }) => {
  const location = useLocation();
  const from = invite ? location.pathname + location.search + location.hash : undefined;
  const register: AuthLocationState = { view: "register", from };
  const login: AuthLocationState = { view: "login", from };

  return (
    <div className={`Content__body Landing${invite ? " Landing--invited" : ""}`}>
      <header className="Landing__hero">
        <h1>moneylogs</h1>
        <p className="Landing__pitch">
          A calm way to keep track of your spending. Log what you spent and why, in any currency,
          and see where the month went. Keep it to yourself, or let a few friends follow along — and
          when you travel together, start a group log for the trip.
        </p>
        <div className="Landing__actions">
          <Button to="/login" state={register} text="Create an account" />
          <Button to="/login" state={login} text="Sign in" variant="secondary" />
          {/* Invites need a real account, so invited visitors aren't offered this. */}
          {!invite && <TryAsGuest />}
        </div>
      </header>

      <PreviewWindow title="Home" label="Example home dashboard">
        <div className="Dashboard">
          <section className="Dashboard__section" aria-labelledby="landing-now">
            <div className="Dashboard__heading">
              <h3 id="landing-now">Now</h3>
              <Link to="/login" state={register} className="Dashboard__action">
                + start a new log
              </Link>
            </div>
            <div className="Dashboard__grid Dashboard__grid--large">
              <SampleCards cards={SAMPLE_NOW} size="large" register={register} />
            </div>
          </section>
          <section className="Dashboard__section" aria-labelledby="landing-upcoming">
            <h3 id="landing-upcoming">Coming up</h3>
            <div className="Dashboard__grid Dashboard__grid--small">
              <SampleCards cards={SAMPLE_UPCOMING} size="small" register={register} />
            </div>
          </section>
          <section className="Dashboard__section" aria-labelledby="landing-recent">
            <h3 id="landing-recent">Recently ended</h3>
            <div className="Dashboard__grid Dashboard__grid--compact">
              <SampleCards cards={SAMPLE_RECENT} size="compact" register={register} />
            </div>
          </section>
        </div>
      </PreviewWindow>

      <Points id="landing-tracking" heading="Your spending, day to day" points={TRACKING}>
        <p className="Landing__note">
          Already tracking somewhere else? Import a CSV export from{" "}
          <a href={EXTERNAL_LINKS.moneyForward} target="_blank" rel="noopener noreferrer">
            Money Forward ME
          </a>{" "}
          or{" "}
          <a href={EXTERNAL_LINKS.ynab} target="_blank" rel="noopener noreferrer">
            YNAB
          </a>{" "}
          and pick up where you left off.
        </p>
      </Points>

      <PreviewWindow title={SAMPLE_LEDGER.title} label="Example financial log">
        <LedgerPreview />
      </PreviewWindow>

      <Points id="landing-friends" heading="With friends, gently" points={WITH_FRIENDS} />

      <PreviewWindow title={SAMPLE_TRIP_TITLE} label="Example group log entries">
        <div className="Landing__posts">
          <div className="LogPosts__posts__banner LogPosts__posts__item__header">
            <div className="LogPosts__posts__banner__left">{SAMPLE_DAY.label}</div>
            <div className="LogPosts__posts__banner__center">
              <span>{SAMPLE_DAY.total}</span>
            </div>
            <div />
          </div>
          {SAMPLE_POSTS.map((post) => (
            <article className="LogPosts__posts__item" key={post.time}>
              <div className="LogPosts__posts__item__header">
                <div className="LogPosts__posts__item__header__left LogPosts__posts__item__date">
                  <IconText type="clock" text={post.time} />
                </div>
                <div className="LogPosts__posts__item__header__center LogPosts__posts__item__amount">
                  {post.amount}
                </div>
                <div className="LogPosts__posts__item__header__right LogPosts__posts__item__comments">
                  <span className="PostReactions">
                    {post.reactions.map((r) => (
                      <span className="PostReactions__tally" key={r.emoji}>
                        <span className="PostReactions__emoji">{r.emoji}</span>
                        <span className="PostReactions__count">{r.count}</span>
                      </span>
                    ))}
                  </span>
                  <IconText type="speech" text={String(post.comments)} size={18} />
                </div>
              </div>
              <div className="LogPosts__posts__item__body">
                <p className="Landing__post__author">{post.author}</p>
                <p>{post.text}</p>
              </div>
            </article>
          ))}
        </div>
      </PreviewWindow>

      <section className="Landing__steps" aria-labelledby="landing-how">
        <h2 id="landing-how">How it works</h2>
        <ol>
          {HOW_IT_WORKS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="Landing__cta">
        {!invite && <p>Got an invite link? Open it, sign up, and you'll go straight to it.</p>}
        <div className="Landing__actions">
          <Button to="/login" state={register} text="Create an account" />
          <Button to="/about" text="About" variant="secondary" />
        </div>
      </footer>

      {invite && <InviteBar invite={invite} register={register} login={login} />}
    </div>
  );
};

export default Landing;
