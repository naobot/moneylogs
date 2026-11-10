import { ReactNode, SyntheticEvent, useEffect, useRef, useState } from "react";
import cx from "classnames";

import { readDrawerOpen, writeDrawerOpen } from "@/utils/drawerState";

import "./Drawer.scss";

const isLinkedTo = (id: string) => {
  try {
    return window.location.hash === `#${id}`;
  } catch {
    return false;
  }
};

type DrawerProps = {
  /** Stable id: the element id (so `#id` links open it) and the storage key. */
  id: string;
  title: ReactNode;
  /** Short muted hint beside the title, e.g. "3 unlocked". */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * A collapsible section built on native <details>, so keyboard and screen-reader
 * support come for free. Remembers whether it was left open, and opens itself when
 * the page is loaded with `#<id>` in the URL.
 */
export const Drawer = ({ id, title, summary, defaultOpen = false, children }: DrawerProps) => {
  // Read once: a later hash change shouldn't reopen drawers or yank the page around.
  const [linked] = useState(() => isLinkedTo(id));
  const [open, setOpen] = useState(() => linked || (readDrawerOpen(id) ?? defaultOpen));
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (linked) ref.current?.scrollIntoView?.({ block: "start" });
  }, [linked]);

  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const next = e.currentTarget.open;
    if (next === open) return;
    setOpen(next);
    writeDrawerOpen(id, next);
  };

  return (
    <details
      id={id}
      ref={ref}
      className={cx("Drawer", { "Drawer--open": open })}
      open={open}
      onToggle={handleToggle}
    >
      <summary className="Drawer__summary">
        <span className="Drawer__title">{title}</span>
        {summary !== undefined && <span className="Drawer__hint">{summary}</span>}
        <span className="Drawer__marker" aria-hidden="true">
          {open ? "[-]" : "[+]"}
        </span>
      </summary>
      <div className="Drawer__body">{children}</div>
    </details>
  );
};

export default Drawer;
