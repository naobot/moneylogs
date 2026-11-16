import Avatar from "@/components/Avatar";
import { useMemberProfile } from "@/features/moneylog/components/LogPosts/memberNames";

import ProfileLink from "./ProfileLink";

type MemberAvatarLinkProps = {
  userDocId?: string | null;
  /** Fallback when the profile isn't loaded or is gone (a deleted account). */
  name?: string | null;
  /** Show the name beside the avatar, inside the same link. */
  withName?: boolean;
  /** Extra text after the name, e.g. "(Kyoto)". */
  suffix?: string | null;
  className?: string;
};

/** A log member's 30px avatar (and optionally name) linking to their profile. */
export const MemberAvatarLink = ({
  userDocId,
  name,
  withName = false,
  suffix,
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
      <Avatar avatar={profile?.avatar} name={shownName} size={30} />
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
