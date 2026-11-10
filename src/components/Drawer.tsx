import { ReactNode, SyntheticEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import cx from "classnames";

import { readDrawerOpen, writeDrawerOpen } from "@/utils/drawerState";

import "./Drawer.scss";

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
 * support come for free. Remembers whether it was left open, and opens itself (and
 * scrolls into view) whenever the URL is navigated to `#<id>` — on first load, from a
 * link elsewhere in the app, or while already on the page.
 */
export const Drawer = ({ id, title, summary, defaultOpen = false, children }: DrawerProps) => {
  const { hash, key } = useLocation();
  const linked = hash === `#${id}`;
  const [open, setOpen] = useState(() => linked || (readDrawerOpen(id) ?? defaultOpen));
  const ref = useRef<HTMLDetailsElement>(null);

  // Each navigation to #id (a new location key, even with the same hash, e.g. clicking
  // the link again after closing the drawer) opens it and brings it into view.
  useEffect(() => {
    if (!linked) return;
    setOpen(true);
    writeDrawerOpen(id, true);
    ref.current?.scrollIntoView?.({ block: "start" });
  }, [linked, key, id]);

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
