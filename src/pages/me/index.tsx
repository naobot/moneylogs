import { useMemo } from "react";

import { useCurrentUser } from "@/contexts";
import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { useGetAchievements, sortAchievementsByGroupEnd } from "@/hooks/useAchievements";

import Drawer from "@/components/Drawer";
import { ProfileSection } from "@/features/account/ProfileSection";
import { AccountSection } from "@/features/account/AccountSection";
import { AchievementsSection } from "@/features/account/AchievementsSection";
import { MyLogsSection } from "@/features/account/MyLogsSection";
import { DisplaySection, displaySummary } from "@/features/account/DisplaySection";
import { myLogsHint } from "@/features/account/myLogsHint";
import { NotificationsSection } from "@/features/account/NotificationsSection";
import { notificationsSummary } from "@/features/account/notificationSettings";
import { FriendsSection } from "@/features/account/FriendsSection";
import { friendsHint } from "@/features/account/friendsHint";
import { useFriendships } from "@/hooks/useFriendships";
import { partitionArchived } from "@/utils/archivedLogs";
import { partitionByTime } from "@/utils/groupBoundaries";
import { useTheme } from "@/utils/theme";
import { useDisplayPrefs } from "@/utils/displayPrefs";

import "@/components/ProfileFields.scss";
import "./me.scss";
import { PushSection } from "@/features/account/PushSection";
import { pushAvailable } from "@/features/push/devicePush";
import { useIsAdmin } from "@/features/admin/useIsAdmin";
import { Link } from "react-router-dom";

// Personal settings plus everything tied to the account, in drawers. "logs" is linked
// to from Home as /me#logs, which opens that drawer.
export const UserSettings = () => {
  const { user, isLoading: userLoading } = useCurrentUser();
  const theme = useTheme();
  const displayPrefs = useDisplayPrefs();
  const { allGroups: groups, isLoading: groupsLoading } = useGetCurrentGroups();
  const { ledgers: allLedgers, isLoading: ledgersLoading } = useGetMyLedgers();
  const { achievements, isLoading: achievementsLoading } = useGetAchievements(user?.id);
  const { friends, incoming, isLoading: friendsLoading } = useFriendships();
  // Until these are in, the drawers say "…" rather than "0" or "none yet". Logs wait for
  // the user too: which are archived is on the user doc.
  const logsLoading = groupsLoading || ledgersLoading || userLoading;
  const loadingNote = <p className="GroupArchive__empty">…</p>;
  const isAdmin = useIsAdmin();

  const { active: activeGroups, archived: archivedGroups } = partitionArchived(groups, user);
  const { active: ledgers, archived: archivedLedgers } = partitionArchived(allLedgers, user);
  const { ongoing, upcoming, past } = partitionByTime(activeGroups);

  // Most recently ended group first. All groups (archived too), so archiving doesn't
  // reshuffle achievements.
  const orderedAchievements = useMemo(
    () => sortAchievementsByGroupEnd(achievements, groups),
    [achievements, groups],
  );

  const archivedCount = archivedGroups.length + archivedLedgers.length;

  return (
    <div className="Window UserSettings ProfileFields">
      <div className="Window__heading">
        {user?.displayName && (
          <h2>
            hi <span className="keep-case">{user?.displayName}</span>
          </h2>
        )}
      </div>

      <div className="UserSettings__drawers">
        <Drawer
          id="profile"
          title="Profile"
          summary={
            user?.timezone
              ? `${user.displayName ?? ""} · ${user.timezonePlace || user.timezone}`
              : "set your timezone"
          }
          defaultOpen
        >
          <ProfileSection />
        </Drawer>

        <Drawer
          id="friends"
          title="friends"
          summary={
            friendsLoading
              ? "…"
              : friendsHint({ friends: friends.length, incoming: incoming.length })
          }
        >
          <FriendsSection />
        </Drawer>

        <Drawer id="display" title="Display" summary={displaySummary(theme, displayPrefs)}>
          <DisplaySection />
        </Drawer>

        <Drawer id="notifications" title="notifications" summary={notificationsSummary(user)}>
          {/* Push is a setting of this phone, so it shows only in the native app. */}
          {pushAvailable() && <PushSection />}
          <NotificationsSection />
        </Drawer>

        <Drawer id="account" title="Account" summary={user?.email}>
          <AccountSection />
        </Drawer>

        <Drawer
          id="achievements"
          title="Achievements"
          summary={achievementsLoading ? "…" : `${orderedAchievements.length} unlocked`}
        >
          {achievementsLoading || !user ? (
            loadingNote
          ) : (
            <AchievementsSection achievements={orderedAchievements} />
          )}
        </Drawer>

        <Drawer
          id="logs"
          title="my logs"
          summary={
            logsLoading
              ? "…"
              : myLogsHint({
                  financial: ledgers.length,
                  ongoing: ongoing.length,
                  upcoming: upcoming.length,
                  past: past.length,
                  archived: archivedCount,
                })
          }
        >
          {logsLoading ? (
            loadingNote
          ) : (
            <MyLogsSection
              ledgers={ledgers}
              ongoing={ongoing}
              upcoming={upcoming}
              past={past}
              archivedGroups={archivedGroups}
              archivedLedgers={archivedLedgers}
            />
          )}
        </Drawer>
      </div>

      {isAdmin && (
        <p className="UserSettings__admin">
          <Link to="/admin">admin tools →</Link>
        </p>
      )}
    </div>
  );
};
