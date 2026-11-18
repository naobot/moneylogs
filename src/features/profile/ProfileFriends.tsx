import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useProfiles } from "@/hooks/useProfiles";
import {
  MemberProfile,
  MemberProfilesContext,
} from "@/features/moneylog/components/LogPosts/memberNames";

import MemberAvatarLink from "./MemberAvatarLink";
import { useFriendList } from "./useFriendList";

type ProfileFriendsProps = {
  userDocId: string;
  /** Viewing your own profile: say whether others can see the list, and where to change it. */
  isMe: boolean;
};

/**
 * A profile's friends, as avatars only (hover one for the profile peek, tap it for their
 * profile). Hidden by default: other people see the section only when the owner has
 * switched it on in /me. The owner sees exactly what others see, plus a note.
 */
export const ProfileFriends = ({ userDocId, isMe }: ProfileFriendsProps) => {
  const { friends, isLoading } = useFriendList(userDocId);
  const { profiles, isLoading: profilesLoading } = useProfiles(friends ?? []);
  const memberProfiles = useMemo(
    () =>
      new Map<string, MemberProfile>(
        [...profiles].map(([id, p]) => [id, { displayName: p.displayName, avatar: p.avatar }]),
      ),
    [profiles],
  );

  if (isLoading || profilesLoading) return null;
  if (!friends && !isMe) return null;

  // A deleted account drops out of the list as its friendships go (mirrorFriendList).
  const shown = friends ?? [];

  return (
    <section className="ProfilePage__section" aria-labelledby="profile-friends">
      <h3 id="profile-friends">friends</h3>
      {friends === null ? (
        <p className="ProfilePage__muted">
          your friends list is hidden from others.{" "}
          <Link to="/me#friends">show it on your profile</Link>
        </p>
      ) : (
        <>
          {shown.length > 0 ? (
            <MemberProfilesContext.Provider value={memberProfiles}>
              <ul className="ProfileFriends" aria-label="friends">
                {shown.map((id) => (
                  <li key={id}>
                    <MemberAvatarLink userDocId={id} />
                  </li>
                ))}
              </ul>
            </MemberProfilesContext.Provider>
          ) : (
            <p className="ProfilePage__muted">no friends to show yet.</p>
          )}
          {isMe && (
            <p className="ProfilePage__muted">
              signed-in people can see this list. <Link to="/me#friends">change</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default ProfileFriends;
