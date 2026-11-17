import { ReactNode, SyntheticEvent, useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { requestFriend, respondFriend, useFriendships } from "@/hooks/useFriendships";
import { isMousePointer, useHoverIntent } from "@/hooks/useHoverIntent";
import { useNow } from "@/hooks/useNow";
import { useProfile } from "@/hooks/useProfiles";
import { useDateFormat } from "@/utils/dateFormat";

import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import Popover from "@/components/Popover";

import { useFriendAction } from "./useFriendAction";

/**
 * How long the pointer must rest on an avatar before the peek opens. Longer than the
 * app's usual hover delay: avatars sit all over busy lists, and the card carries an
 * "Add friend" button, so it shouldn't pop up as the cursor passes by.
 */
export const PROFILE_PEEK_DELAY = 800;

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** The card: who they are, their local time, and where you stand with them. */
const PeekCard = ({ userDocId }: { userDocId: string }) => {
  const { profile, isLoading } = useProfile(userDocId);
  const { stateWith, isLoading: friendsLoading } = useFriendships();
  const { run, pending } = useFriendAction();
  const { formatTime } = useDateFormat();
  const now = useNow();

  if (isLoading) return <p className="ProfilePeek__muted">loading…</p>;
  if (!profile) return <p className="ProfilePeek__muted">this account was deleted.</p>;

  const state = stateWith(userDocId);
  const localTime = profile.timezone ? formatTime(now.tz(profile.timezone)) : null;

  return (
    <>
      <div className="ProfilePeek__head">
        <Avatar avatar={profile.avatar} name={profile.displayName} size={60} />
        <div className="ProfilePeek__who">
          <strong className="keep-case">{profile.displayName}</strong>
          {profile.displayLocation && <span className="keep-case">{profile.displayLocation}</span>}
          {localTime && <span className="ProfilePeek__muted">{localTime} there now</span>}
        </div>
      </div>
      <div className="ProfilePeek__actions">
        {!friendsLoading && state === "none" && (
          <Button
            text="Add friend"
            size="sm"
            variant="primary"
            loading={pending === "request"}
            onClick={() =>
              void run("request", () => requestFriend(userDocId), "Friend request sent")
            }
          />
        )}
        {state === "incoming" && (
          <Button
            text="Accept"
            size="sm"
            variant="primary"
            loading={pending === "accept"}
            onClick={() =>
              void run("accept", () => respondFriend(userDocId, true), "You're friends now")
            }
          />
        )}
        {state === "outgoing" && <span className="ProfilePeek__muted">request sent</span>}
        {state === "friends" && <span className="ProfilePeek__friends">friends</span>}
        <Link to={`/u/${userDocId}`} className="ProfilePeek__more">
          view profile
        </Link>
      </div>
    </>
  );
};

type PeekableProps = {
  userDocId?: string | null;
  name?: string | null;
  children: ReactNode;
};

/**
 * Wraps an avatar so resting the mouse on it opens a small profile card with a quick
 * "Add friend". Mouse only (touch taps straight through to the profile), signed-in
 * viewers only, and never for yourself or a deleted account.
 */
export const ProfilePeek = ({ userDocId, name, children }: PeekableProps) => {
  const { user } = useCurrentUser();
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const { openAfterDelay, cancelOpen, closeAfterDelay, cancelClose } = useHoverIntent({
    openDelay: PROFILE_PEEK_DELAY,
  });

  const enabled = !!user?.id && !!userDocId && userDocId !== user.id;
  if (!enabled) return <>{children}</>;

  const close = () => {
    cancelOpen();
    setOpen(false);
  };

  return (
    <span
      ref={setAnchor}
      className="ProfilePeek__anchor"
      onPointerEnter={(e) => {
        if (!isMousePointer(e)) return;
        cancelClose();
        openAfterDelay(() => setOpen(true));
      }}
      onPointerLeave={(e) => {
        if (!isMousePointer(e)) return;
        cancelOpen();
        closeAfterDelay(() => setOpen(false));
      }}
    >
      {children}
      {open && (
        <Popover
          anchor={anchor}
          open
          onClose={close}
          placement="bottom"
          align="start"
          className="ProfilePeek"
          role="dialog"
          aria-label={`${name ?? "someone"}'s profile`}
          onPointerEnter={cancelClose}
          onPointerLeave={(e) => isMousePointer(e) && closeAfterDelay(() => setOpen(false))}
        >
          {/* Portalled, but React events still bubble to the avatar's link and to
              clickable / draggable member rows: keep them in here. */}
          <div className="ProfilePeek__card" onClick={stop} onPointerDown={stop}>
            <PeekCard userDocId={userDocId} />
          </div>
        </Popover>
      )}
    </span>
  );
};

export default ProfilePeek;
