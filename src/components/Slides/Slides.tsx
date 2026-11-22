import { ReactNode, useState } from "react";
import cx from "classnames";

import Button from "@/components/Button";
import Modal from "@/components/Modal";
import "./Slides.scss";

export type Slide = {
  /** Stable key, e.g. "one-log-feeds-another". */
  id: string;
  /** Lowercase, like every heading. */
  heading: string;
  /** The picture: built from the app's own pieces, never decoration only. */
  art?: ReactNode;
  /** The point of the slide, in sentence case. */
  text: ReactNode;
  /** A worked example, after the text. */
  example?: ReactNode;
};

/** How the slides were closed: read to the end, or left before it. */
export type SlidesResult = "finished" | "skipped";

type SlidesProps = {
  isOpen: boolean;
  /** The window's title, e.g. "what's a sublog?". */
  title: ReactNode;
  slides: ReadonlyArray<Slide>;
  onClose: (result: SlidesResult) => void;
  /** An extra button on the last slide, e.g. to start doing the thing just explained. */
  action?: { text: string; onClick: () => void };
};

/**
 * A short introduction to a feature, one slide at a time, in a tool-style modal: a
 * picture, a sentence or two, an example. Back / next, a skip link until the end, and
 * dots that show where you are. For features whose screens are familiar but whose idea
 * is new; for pointing at controls on a page, use TutorialTooltip instead.
 */
export const Slides = ({ isOpen, title, slides, onClose, action }: SlidesProps) => {
  const [index, setIndex] = useState(0);
  // Each opening starts from the first slide.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setIndex(0);
  }

  const last = slides.length - 1;
  const atEnd = index >= last;
  const slide = slides[Math.min(index, last)];
  if (!slide) return null;

  const close = () => onClose(atEnd ? "finished" : "skipped");

  return (
    <Modal isOpen={isOpen} onClose={close} className="Slides">
      <Modal.Header striped showCloseButton title={title} />
      <Modal.Body className="Slides__body">
        <section className="Slides__slide" aria-roledescription="slide" aria-live="polite">
          <h3 className="Slides__heading">{slide.heading}</h3>
          {slide.art && <div className="Slides__art">{slide.art}</div>}
          <p className="Slides__text">{slide.text}</p>
          {slide.example && <p className="Slides__example">{slide.example}</p>}
        </section>
      </Modal.Body>
      <Modal.Actions className="Slides__foot">
        <span
          className="Slides__dots"
          role="img"
          aria-label={`slide ${index + 1} of ${slides.length}`}
        >
          {slides.map((s, i) => (
            <span key={s.id} className={cx("Slides__dot", { "Slides__dot--on": i === index })} />
          ))}
        </span>
        {!atEnd && (
          <button type="button" className="Slides__skip" onClick={() => onClose("skipped")}>
            skip
          </button>
        )}
        <Button
          text="Back"
          size="sm"
          variant="secondary"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        />
        {atEnd ? (
          <>
            <Button
              text="Done"
              size="sm"
              variant={action ? "secondary" : "primary"}
              onClick={close}
            />
            {action && (
              <Button
                text={action.text}
                size="sm"
                onClick={() => {
                  onClose("finished");
                  action.onClick();
                }}
              />
            )}
          </>
        ) : (
          <Button text="Next" size="sm" onClick={() => setIndex((i) => Math.min(last, i + 1))} />
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default Slides;
