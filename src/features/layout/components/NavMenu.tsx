import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { LoadingDots } from "@/components/LoadingDots";
import Modal from "@/components/Modal";
import Popover from "@/components/Popover";
import { SizeRows, ThemeRow } from "@/features/account/DisplaySection";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { track } from "@/utils/analytics";
import { setTheme, THEME_LABELS } from "@/utils/theme";
import { themeIcon, useThemeToggle } from "./useThemeToggle";

/**
 * Display settings that matter from any screen: theme, text size, UI size and entry text.
 * The rest (colour theme, charts, dates) stays in /me Display, linked at the bottom.
 */
export const QuickDisplay = ({
  isOpen,
  onClose,
  isLoggedIn,
}: {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
}) => (
  <Modal isOpen={isOpen} onClose={onClose} className="QuickDisplay">
    <Modal.Header title="display" showCloseButton />
    <Modal.Body>
      <ThemeRow />
      <SizeRows from="nav" />
      <p className="DisplaySection__hint">
        Saved on this device only.
        {isLoggedIn && (
          <>
            {" "}
            <Link to="/me#display" onClick={onClose}>
              all display settings
            </Link>
          </>
        )}
      </p>
    </Modal.Body>
  </Modal>
);

/**
 * The nav's dropdown (a caret), far right: display settings (the eye) for everyone, the
 * theme toggle on phones (wide screens keep it in the nav, beside the caret), and sign out
 * when signed in. Display opens QuickDisplay over whatever page you're on.
 */
export const NavMenu = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const { pathname } = useLocation();
  const { signOut, isPending: signOutPending } = useSignOut();
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Any navigation closes it, back and forward included: reset during render when the
  // path changes (no effect, so it never paints open on the new page). Remembering the
  // path it was opened on instead would reopen it on returning there.
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setOpen(false);
  }
  const [displayOpen, setDisplayOpen] = useState(false);
  const themeToggle = useThemeToggle(isLoggedIn);

  // Keyboard users land on the first item, as in any menu.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [open]);

  const openDisplay = () => {
    setOpen(false);
    setDisplayOpen(true);
    track("quick_display", { signed_in: isLoggedIn });
  };

  return (
    <>
      <span ref={setAnchor} className="NavMenu">
        <Button
          variant="icon"
          className="NavMenu__trigger"
          title="Menu"
          aria-label={isLoggedIn ? "Menu: display, theme and sign out" : "Menu: display and theme"}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="nav-menu"
          icon="caret"
          onClick={() => setOpen(!open)}
        />
      </span>
      <Popover
        anchor={anchor}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom"
        align="end"
        className="NavMenu__panel"
      >
        <div ref={menuRef} id="nav-menu" role="menu" aria-label="Menu">
          <button type="button" role="menuitem" className="NavMenu__item" onClick={openDisplay}>
            <Icon type="eye" />
            display
          </button>
          {/* Phones only (see App.scss): it stays open, so the next tap cycles on. */}
          <button
            type="button"
            role="menuitem"
            className="NavMenu__item NavMenu__item--theme"
            aria-label={themeToggle.label}
            onClick={() => setTheme(themeToggle.next)}
          >
            <Icon type={themeIcon(themeToggle.theme)} />
            {`theme · ${THEME_LABELS[themeToggle.theme].toLowerCase()}`}
          </button>
          {isLoggedIn && (
            <button
              type="button"
              role="menuitem"
              className="NavMenu__item"
              onClick={signOut}
              disabled={signOutPending}
              aria-busy={signOutPending || undefined}
            >
              <Icon type="exit" />
              sign out
              {signOutPending && <LoadingDots label="" />}
            </button>
          )}
        </div>
      </Popover>
      <QuickDisplay
        isOpen={displayOpen}
        onClose={() => setDisplayOpen(false)}
        isLoggedIn={isLoggedIn}
      />
    </>
  );
};

export default NavMenu;
