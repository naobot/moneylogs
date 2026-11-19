import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useProfiles } from "@/hooks/useProfiles";
import {
  MemberProfile,
  MemberProfilesContext,
} from "@/features/moneylog/components/LogPosts/memberNames";
import MemberAvatarLink from "@/features/profile/MemberAvatarLink";

import { useFriendsByActivity } from "./useFriendsByActivity";

/** How many friends the dashboard shows before linking to the rest. */
export const DASHBOARD_FRIENDS = 12;

/**
 * Your friends on the dashboard, avatar and name, each linking to their profile. They're
 * ordered by who was around most recently, which the page deliberately doesn't spell
 * out: it just tends to put the people you're likely to hear from on top.
 */
export const DashboardFriends = () => {
  const { friends, isLoading } = useFriendsByActivity();
  const shown = friends.slice(0, DASHBOARD_FRIENDS);
  const { profiles, isLoading: profilesLoading } = useProfiles(shown);
  const memberProfiles = useMemo(
    () =>
      new Map<string, MemberProfile>(
        [...profiles].map(([id, p]) => [id, { displayName: p.displayName, avatar: p.avatar }]),
      ),
    [profiles],
  );

  return (
    <section className="Dashboard__section DashboardFriends" aria-labelledby="dashboard-friends">
      <div className="Dashboard__heading">
        <h3 id="dashboard-friends">friends</h3>
        {friends.length > 0 && (
          <Link to="/me#friends" className="Dashboard__action">
            see <strong>all friends</strong>
          </Link>
        )}
      </div>
      {isLoading || (shown.length > 0 && profilesLoading) ? (
        <p className="DashboardFriends__muted">…</p>
      ) : shown.length === 0 ? (
        <p className="DashboardFriends__muted">
          no friends yet. <Link to="/me#friends">invite someone</Link>, or add people from your
          logs.
        </p>
      ) : (
        <MemberProfilesContext.Provider value={memberProfiles}>
          <ul className="DashboardFriends__list" aria-label="friends">
            {shown.map((id) => (
              <li key={id}>
                <MemberAvatarLink userDocId={id} withName />
              </li>
            ))}
          </ul>
          {friends.length > shown.length && (
            <p className="DashboardFriends__muted">
              <Link to="/me#friends">and {friends.length - shown.length} more</Link>
            </p>
          )}
        </MemberProfilesContext.Provider>
      )}
    </section>
  );
};

export default DashboardFriends;
