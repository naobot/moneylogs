import { ReactNode } from "react";

import { removeFriend, respondFriend, useFriendships } from "@/hooks/useFriendships";
import { Profile, useProfiles } from "@/hooks/useProfiles";
import Avatar from "@/components/Avatar";
import RowButton from "@/components/RowButton";
import ProfileLink from "@/features/profile/ProfileLink";
import { useFriendAction } from "@/features/profile/useFriendAction";
import InviteLink from "@/features/invites/InviteLink";

const DELETED_USER = "deleted user";

const PersonRow = ({
  id,
  profile,
  children,
}: {
  id: string;
  profile?: Profile;
  children?: ReactNode;
}) => (
  <li className="FriendsSection__row">
    <ProfileLink userDocId={profile ? id : null}>
      <Avatar avatar={profile?.avatar} name={profile?.displayName ?? DELETED_USER} size={30} />
      <span className="ProfileLink__name keep-case">{profile?.displayName ?? DELETED_USER}</span>
    </ProfileLink>
    {children && <span className="FriendsSection__actions">{children}</span>}
  </li>
);

/**
 * Friends and friend requests on /me, with your invite link. Adding happens from someone's
 * profile (linked from shared logs, or a profile link they sent you) or through your invite
 * link, which makes whoever opens it your friend; answering requests happens here too.
 */
export const FriendsSection = () => {
  const { friends, incoming, outgoing, entries, isLoading } = useFriendships();
  const profiles = useProfiles(entries.map((e) => e.userDocId));
  const { run, pending } = useFriendAction();

  if (isLoading) return null;

  return (
    <div className="FriendsSection">
      <InviteLink />

      {incoming.length > 0 && (
        <div>
          <h4>requests</h4>
          <ul className="FriendsSection__list">
            {incoming.map((id) => (
              <PersonRow key={id} id={id} profile={profiles.get(id)}>
                <RowButton
                  disabled={!!pending}
                  onClick={() =>
                    void run(`accept-${id}`, () => respondFriend(id, true), "You're friends now")
                  }
                >
                  accept
                </RowButton>
                <RowButton
                  disabled={!!pending}
                  onClick={() => void run(`decline-${id}`, () => respondFriend(id, false))}
                >
                  decline
                </RowButton>
              </PersonRow>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4>friends</h4>
        {friends.length > 0 ? (
          <ul className="FriendsSection__list">
            {friends.map((id) => (
              <PersonRow key={id} id={id} profile={profiles.get(id)} />
            ))}
          </ul>
        ) : (
          <p className="FriendsSection__empty">
            no friends yet. Send someone your invite link above, or open someone's profile from a
            log you share (tap their avatar).
          </p>
        )}
      </div>

      {outgoing.length > 0 && (
        <div>
          <h4>sent</h4>
          <ul className="FriendsSection__list">
            {outgoing.map((id) => (
              <PersonRow key={id} id={id} profile={profiles.get(id)}>
                <RowButton
                  disabled={!!pending}
                  onClick={() => void run(`cancel-${id}`, () => removeFriend(id))}
                >
                  cancel
                </RowButton>
              </PersonRow>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FriendsSection;
