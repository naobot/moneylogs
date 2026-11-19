import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Avatar from "@/components/Avatar";
import Popover from "@/components/Popover";
import { useProfiles } from "@/hooks/useProfiles";
import {
  MemberProfile,
  MemberProfilesContext,
  useMemberProfile,
} from "@/features/moneylog/components/LogPosts/memberNames";
import NudgeActions from "@/features/nudges/NudgeActions";
import NudgeBubble from "@/features/nudges/NudgeBubble";
import { Nudge, nudgedFirst } from "@/features/nudges/nudges";
import { useNudges } from "@/features/nudges/useNudges";

import { useFriendsByActivity } from "./useFriendsByActivity";

/** How many friends the dashboard shows before linking to the rest. */
export const DASHBOARD_FRIENDS = 12;

/**
 * Your friends on the dashboard, avatar and name. Tapping one opens a little menu to
 * poke them, cheer them on or visit their profile; anything they've sent you shows as
 * a bouncing "!" over their avatar. They're ordered by who was around most recently,
 * which the page deliberately doesn't spell out (anyone with something waiting for you
 * comes first, so it's never cut off).
 */
export const DashboardFriends = () => {
  const { friends: byActivity, uidOf, isLoading } = useFriendsByActivity();
  const nudges = useNudges();
  const friends = useMemo(() => nudgedFirst(byActivity, nudges), [byActivity, nudges]);
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
                <DashboardFriend userDocId={id} uid={uidOf(id)} nudge={nudges.get(id)} />
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

/** One friend: avatar and name opening the poke / cheer / profile menu. */
const DashboardFriend = ({
  userDocId,
  uid,
  nudge,
}: {
  userDocId: string;
  uid: string | null;
  nudge?: Nudge;
}) => {
  const profile = useMemberProfile(userDocId);
  const name = profile?.displayName ?? "someone";
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="DashboardFriends__friend">
      <button
        ref={setAnchor}
        type="button"
        className="DashboardFriends__person"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar avatar={profile?.avatar} name={name} size={30} />
        <span className="DashboardFriends__name keep-case">{name}</span>
      </button>
      {nudge && (
        <span className="DashboardFriends__nudge">
          <NudgeBubble nudge={nudge} name={name} />
        </span>
      )}
      <Popover
        anchor={anchor}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom"
        align="start"
        role="menu"
        aria-label={name}
        className="DashboardFriends__menu"
      >
        <NudgeActions
          userDocId={userDocId}
          toUid={uid}
          name={name}
          inline
          onCheered={() => setOpen(false)}
        />
        <Link to={`/u/${userDocId}`} className="DashboardFriends__profile" role="menuitem">
          profile →
        </Link>
      </Popover>
    </div>
  );
};

export default DashboardFriends;
