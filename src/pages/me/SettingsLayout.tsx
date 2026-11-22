import { ReactNode, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import cx from "classnames";

import { track } from "@/utils/analytics";
import { resolveSection } from "./sections";

export type SettingsSection = {
  /** Stable id, and the `#hash` that opens it. */
  id: string;
  title: string;
  /** Short muted hint under the title in the nav, e.g. "3 unlocked". */
  summary?: ReactNode;
  content: ReactNode;
};

/**
 * Section headings in a nav on the left, the chosen section on the right. The URL hash
 * picks the section, so /me#logs links, back and forward all just work.
 *
 * Phones have room for one column: /me shows the list of sections, /me#x shows only that
 * section with a way back to the list (done in CSS via `SettingsLayout--section`).
 *
 * Every section stays mounted and inactive ones are hidden, so switching away doesn't
 * drop half-typed input (as the old drawers didn't when closed).
 */
export const SettingsLayout = ({ sections }: { sections: SettingsSection[] }) => {
  const { hash, key, pathname } = useLocation();
  const ids = sections.map((s) => s.id);
  const { id: activeId, explicit } = resolveSection(hash, ids);
  const headRef = useRef<HTMLDivElement>(null);

  // On each navigation to a section, bring its heading into view if it's scrolled off
  // (a no-op when it's already visible, so the page doesn't jump on desktop).
  useEffect(() => {
    if (!explicit) return;
    headRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeId, explicit, key]);

  const active = sections.find((s) => s.id === activeId);

  return (
    <div className={cx("SettingsLayout", { "SettingsLayout--section": explicit })}>
      <nav className="SettingsLayout__nav" aria-label="settings sections">
        <ul>
          {sections.map((s) => {
            const isActive = s.id === activeId;
            return (
              <li key={s.id}>
                <Link
                  to={{ hash: s.id }}
                  className={cx("SettingsLayout__navItem", {
                    "SettingsLayout__navItem--active": isActive,
                  })}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    if (!isActive) track("open_me_section", { section: s.id });
                  }}
                >
                  <span className="SettingsLayout__navTitle">{s.title}</span>
                  {s.summary !== undefined && (
                    <span className="SettingsLayout__navHint">{s.summary}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="SettingsLayout__pane">
        <div className="SettingsLayout__paneHead" ref={headRef}>
          <Link to={{ pathname }} className="SettingsLayout__back">
            ← settings
          </Link>
          {active && <h3 id={`me-${active.id}-title`}>{active.title}</h3>}
        </div>
        {sections.map((s) => (
          <section
            key={s.id}
            id={`me-${s.id}`}
            className="SettingsLayout__body"
            aria-labelledby={`me-${s.id}-title`}
            hidden={s.id !== activeId}
          >
            {s.content}
          </section>
        ))}
      </div>
    </div>
  );
};

export default SettingsLayout;
