import { Link } from "react-router-dom";

import Button from "@/components/Button";
import { IconText } from "@/components/Icon";
import { LogCard } from "@/features/dashboard/LogCard";
import type { AuthLocationState } from "@/features/auth/authRedirect";

import {
  HOW_IT_WORKS,
  SAMPLE_DAY,
  SAMPLE_NOW,
  SAMPLE_POSTS,
  SAMPLE_RECENT,
  SAMPLE_UPCOMING,
  SampleCard,
} from "./landingSamples";

import "@/features/dashboard/Dashboard.scss";
import "@/features/moneylog/components/LogPosts/PostReactions.scss";
import "./Landing.scss";

const REGISTER: AuthLocationState = { view: "register" };
const LOGIN: AuthLocationState = { view: "login" };

/** A striped window frame, like the tool modals, around one example screen. */
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
    <div className="Modal__header Modal__header--striped">
      <h2 className="Modal__title">{title}</h2>
      <span className="Modal__header__fill tex-stripe" aria-hidden="true" />
      <span className="Landing__window__tag">example</span>
    </div>
    <div className="Landing__window__body">{children}</div>
  </section>
);

const SampleCards = ({
  cards,
  size,
}: {
  cards: SampleCard[];
  size: "large" | "small" | "compact";
}) =>
  cards.map((card) => (
    <LogCard
      key={card.title}
      to="/login"
      state={REGISTER}
      size={size}
      title={card.title}
      kind={card.kind}
      details={card.details}
      badge={card.badge}
    />
  ));

/**
 * What a logged-out visitor sees at `/`: a short pitch, then Home as it looks once you've
 * joined a few logs (built from the real dashboard cards, filled with made-up logs), a peek
 * inside one log, and how it works. Every example links to registration.
 */
export const Landing = () => (
  <div className="Content__body Landing">
    <header className="Landing__hero">
      <h1>moneylogs</h1>
      <p className="Landing__pitch">
        A private log for you and your friends. Post what you spent and why — on a trip, over a long
        weekend, or month to month at home — in any currency, and see how it all added up when it's
        over.
      </p>
      <div className="Landing__actions">
        <Button to="/login" state={REGISTER} text="Create an account" />
        <Button to="/login" state={LOGIN} text="Sign in" buttonStyle="primary-border" />
      </div>
    </header>

    <PreviewWindow title="Home" label="Example home dashboard">
      <div className="Dashboard">
        <section className="Dashboard__section" aria-labelledby="landing-now">
          <div className="Dashboard__heading">
            <h3 id="landing-now">Now</h3>
            <Link to="/login" state={REGISTER} className="Dashboard__action">
              + start a new log
            </Link>
          </div>
          <div className="Dashboard__grid Dashboard__grid--large">
            <SampleCards cards={SAMPLE_NOW} size="large" />
          </div>
        </section>
        <section className="Dashboard__section" aria-labelledby="landing-upcoming">
          <h3 id="landing-upcoming">Coming up</h3>
          <div className="Dashboard__grid Dashboard__grid--small">
            <SampleCards cards={SAMPLE_UPCOMING} size="small" />
          </div>
        </section>
        <section className="Dashboard__section" aria-labelledby="landing-recent">
          <h3 id="landing-recent">Recently ended</h3>
          <div className="Dashboard__grid Dashboard__grid--compact">
            <SampleCards cards={SAMPLE_RECENT} size="compact" />
          </div>
        </section>
      </div>
    </PreviewWindow>

    <PreviewWindow title={SAMPLE_NOW[0].title} label="Example log entries">
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
      <p>Got an invite link? Open it and you'll be asked to sign up first.</p>
      <div className="Landing__actions">
        <Button to="/login" state={REGISTER} text="Create an account" />
        <Button to="/about" text="About" buttonStyle="primary-border" />
      </div>
    </footer>
  </div>
);

export default Landing;
