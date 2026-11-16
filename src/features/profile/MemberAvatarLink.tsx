import Avatar from "@/components/Avatar";
import { useMemberProfile } from "@/features/moneylog/components/LogPosts/memberNames";

import ProfileLink from "./ProfileLink";
import ProfilePeek from "./ProfilePeek";

type MemberAvatarLinkProps = {
  userDocId?: string | null;
  /** Fallback when the profile isn't loaded or is gone (a deleted account). */
  name?: string | null;
  /** Show the name beside the avatar, inside the same link. */
  withName?: boolean;
  /** Extra text after the name, e.g. "(Kyoto)". */
  suffix?: string | null;
  /** 15 for the mini avatar (comments). */
  size?: 15 | 30;
  className?: string;
};

/**
 * A log member's 30px avatar (and optionally name) linking to their profile. Resting
 * the mouse on the avatar opens a small profile card (ProfilePeek).
 */
export const MemberAvatarLink = ({
  userDocId,
  name,
  withName = false,
  suffix,
  size = 30,
  className,
}: MemberAvatarLinkProps) => {
  const profile = useMemberProfile(userDocId);
  const shownName = name ?? profile?.displayName;

  return (
    <ProfileLink
      userDocId={userDocId}
      className={className}
      label={withName ? undefined : `${shownName ?? "someone"}'s profile`}
    >
      <ProfilePeek userDocId={userDocId} name={shownName}>
        <Avatar avatar={profile?.avatar} name={shownName} size={size} />
      </ProfilePeek>
      {withName && (
        <span className="ProfileLink__name keep-case">
          {shownName}
          {suffix && <> {suffix}</>}
        </span>
      )}
    </ProfileLink>
  );
};

export default MemberAvatarLink;
