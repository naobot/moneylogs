import { ReactNode } from "react";
import { LoadingDots } from "@/components/LoadingDots";

import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { updateUserFields, UserFieldsPatch } from "@/hooks/useUserQuery";
import { reportError } from "@/utils/reportError";
import { removeFriend, respondFriend, useFriendships } from "@/hooks/useFriendships";
import { profileName, ProfilesState, useProfiles } from "@/hooks/useProfiles";
import Avatar from "@/components/Avatar";
import RowButton from "@/components/RowButton";
import ProfileLink from "@/features/profile/ProfileLink";
import { useFriendAction } from "@/features/profile/useFriendAction";
import InviteLink from "@/features/invites/InviteLink";

const PersonRow = ({
  id,
  profiles,
  children,
}: {
  id: string;
  profiles: ProfilesState;
  children?: ReactNode;
}) => {
  const profile = profiles.profiles.get(id);
  // Undefined while loading: "…", not "deleted user", and no avatar initial yet.
  const name = profileName(profiles, id);
  return (
    <li className="FriendsSection__row">
      <ProfileLink userDocId={profile ? id : null}>
        <Avatar avatar={profile?.avatar} name={name} size={30} />
        <span className="ProfileLink__name keep-case">{name ?? <LoadingDots />}</span>
      </ProfileLink>
      {children && <span className="FriendsSection__actions">{children}</span>}
    </li>
  );
};

/**
 * Who can see your friends: your own list on your profile (off unless switched on), and
 * whether you appear on other people's lists (on unless switched off). Saved as changed;
 * the server rebuilds the public lists (functions/src/mirrorFriendList.ts).
 */
const FriendsPrivacy = () => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();

  const save = async (patch: UserFieldsPatch, action: string) => {
    if (!user?.id) return;
    try {
      await updateUserFields(user.id, patch);
    } catch (err) {
      reportError(err, { feature: "friends", action });
      showToast("Couldn't save that setting. Please try again.");
    }
  };

  return (
    <div>
      <h4>privacy</h4>
      <label className="FriendsSection__switch">
        <input
          type="checkbox"
          checked={!!user?.showFriends}
          onChange={(e) => save({ showFriends: e.target.checked }, "toggle_show_friends")}
        />
        <span>Show my friends list on my profile</span>
      </label>
      <label className="FriendsSection__switch">
        <input
          type="checkbox"
          checked={!user?.hideFromFriendLists}
          onChange={(e) =>
            save({ hideFromFriendLists: !e.target.checked }, "toggle_appear_in_friend_lists")
          }
        />
        <span>Appear in other people's friends lists</span>
      </label>
    </div>
  );
};

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
              <PersonRow key={id} id={id} profiles={profiles}>
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
          <ul className="FriendsSection__list FriendsSection__list--columns">
            {friends.map((id) => (
              <PersonRow key={id} id={id} profiles={profiles} />
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
          <ul className="FriendsSection__list FriendsSection__list--columns">
            {outgoing.map((id) => {
              const label = `Cancel friend request to ${profileName(profiles, id) ?? "them"}`;
              return (
                <PersonRow key={id} id={id} profiles={profiles}>
                  <RowButton
                    glyph
                    aria-label={label}
                    title={label}
                    disabled={!!pending}
                    onClick={() => void run(`cancel-${id}`, () => removeFriend(id))}
                  >
                    ×
                  </RowButton>
                </PersonRow>
              );
            })}
          </ul>
        </div>
      )}

      <FriendsPrivacy />
    </div>
  );
};

export default FriendsSection;
