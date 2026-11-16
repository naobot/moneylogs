import { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import cx from "classnames";

import { useCurrentUser } from "@/contexts";

import "./profile.scss";

type ProfileLinkProps = {
  userDocId?: string | null;
  children: ReactNode;
  className?: string;
  /** Accessible name when the children are only an avatar. */
  label?: string;
};

/**
 * Wraps a name or avatar in a link to that person's profile. Profiles are for signed-in
 * people only, so spectators (and deleted users, with no id) get plain content. Clicks
 * don't bubble, so it can sit inside clickable rows.
 */
export const ProfileLink = ({ userDocId, children, className, label }: ProfileLinkProps) => {
  const { user } = useCurrentUser();
  const classes = cx("ProfileLink", className);

  if (!user || !userDocId) return <span className={classes}>{children}</span>;

  return (
    <Link
      to={`/u/${userDocId}`}
      className={cx(classes, "ProfileLink--link")}
      aria-label={label}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
};

export default ProfileLink;
