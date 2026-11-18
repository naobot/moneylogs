import { Link, useParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useNow } from "@/hooks/useNow";
import { useProfile } from "@/hooks/useProfiles";
import { useDateFormat } from "@/utils/dateFormat";

import Avatar from "@/components/Avatar";
import FriendControls from "@/features/profile/FriendControls";
import KnickKnackShelf from "@/features/profile/KnickKnackShelf";
import ProfileFriends from "@/features/profile/ProfileFriends";
import { sharedGroups } from "@/features/profile/sharedLogs";

import "@/features/profile/profile.scss";

/** /u/:userDocId — someone's public profile, for signed-in people. */
export const UserProfilePage = () => {
  const { userDocId } = useParams<{ userDocId: string }>();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { profile, isLoading } = useProfile(userDocId);
  const { allGroups, isLoading: groupsLoading } = useGetCurrentGroups();
  const { formatTime } = useDateFormat();
  const now = useNow();

  const isMe = !!user?.id && user.id === userDocId;

  // Wait for the viewer too: until then, isMe can't be told and your own profile would
  // show "Add friend".
  if (isLoading || userLoading) {
    return (
      <div className="Window ProfilePage">
        <p className="ProfilePage__muted">loading…</p>
      </div>
    );
  }

  if (!profile || !userDocId) {
    return (
      <div className="Window ProfilePage">
        <div className="Window__heading">
          <h2>no one here</h2>
        </div>
        <p className="ProfilePage__muted">
          this profile doesn't exist, or the account was deleted.
        </p>
      </div>
    );
  }

  const shared = isMe ? [] : sharedGroups(allGroups, userDocId);
  const localTime = profile.timezone ? formatTime(now.tz(profile.timezone)) : null;

  return (
    <div className="Window ProfilePage">
      <header className="ProfilePage__header">
        <Avatar avatar={profile.avatar} name={profile.displayName} size={60} />
        <div className="ProfilePage__identity">
          <h2 className="keep-case">{profile.displayName}</h2>
          {profile.displayLocation && <p className="keep-case">{profile.displayLocation}</p>}
          {profile.timezone && (
            <p className="ProfilePage__muted">
              <span className="keep-case">{profile.timezone}</span>
              {localTime && <> · {localTime} there now</>}
            </p>
          )}
        </div>
        {isMe && (
          <Link to="/me#profile" className="ProfilePage__edit">
            edit profile
          </Link>
        )}
      </header>

      {!isMe && <FriendControls userDocId={userDocId} name={profile.displayName} />}

      {!isMe && (
        <section className="ProfilePage__section" aria-labelledby="profile-shared">
          <h3 id="profile-shared">logs together</h3>
          {groupsLoading ? (
            <p className="ProfilePage__muted">…</p>
          ) : shared.length > 0 ? (
            <ul className="ProfilePage__logs">
              {shared.map((g) => (
                <li key={g.id}>
                  <Link to={`/g/${g.id}`} className="keep-case">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ProfilePage__muted">no shared logs yet.</p>
          )}
        </section>
      )}

      <ProfileFriends userDocId={userDocId} isMe={isMe} />

      <section className="ProfilePage__section" aria-labelledby="profile-shelf">
        <h3 id="profile-shelf">knick-knack shelf</h3>
        <KnickKnackShelf userDocId={userDocId} />
      </section>
    </div>
  );
};

export default UserProfilePage;
