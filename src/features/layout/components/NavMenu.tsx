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
    <Modal.Header striped title="display" showCloseButton />
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
 * The nav's "more" menu, far right: display settings (the eye) for everyone, and sign out
 * when signed in. Display opens QuickDisplay over whatever page you're on.
 */
export const NavMenu = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const { pathname } = useLocation();
  const { signOut, isPending: signOutPending } = useSignOut();
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The path it was opened on: navigating anywhere closes it, without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [displayOpen, setDisplayOpen] = useState(false);

  // Keyboard users land on the first item, as in any menu.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [open]);

  const openDisplay = () => {
    setOpenOn(null);
    setDisplayOpen(true);
    track("quick_display", { signed_in: isLoggedIn });
  };

  return (
    <>
      <span ref={setAnchor} className="NavMenu">
        <Button
          variant="icon"
          className="NavMenu__trigger"
          title="More"
          aria-label={isLoggedIn ? "More: display settings and sign out" : "More: display settings"}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="nav-menu"
          icon="more"
          onClick={() => setOpenOn(open ? null : pathname)}
        />
      </span>
      <Popover
        anchor={anchor}
        open={open}
        onClose={() => setOpenOn(null)}
        placement="bottom"
        align="end"
        className="NavMenu__panel"
      >
        <div ref={menuRef} id="nav-menu" role="menu" aria-label="More">
          <button type="button" role="menuitem" className="NavMenu__item" onClick={openDisplay}>
            <Icon type="eye" />
            display
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
