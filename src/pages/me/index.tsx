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
import { myLogsHint } from "@/features/account/myLogsHint";
import { partitionArchived } from "@/utils/archivedLogs";
import { partitionByTime } from "@/utils/groupBoundaries";

import "./me.scss";

// Personal settings plus everything tied to the account, in drawers. "logs" is linked
// to from Home as /me#logs, which opens that drawer.
export const UserSettings = () => {
  const { user } = useCurrentUser();
  const { allGroups: groups } = useGetCurrentGroups();
  const { ledgers: allLedgers } = useGetMyLedgers();
  const { achievements } = useGetAchievements(user?.id);

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
    <div className="Window UserSettings">
      <div className="Window__heading">{user?.displayName && <h2>hi {user?.displayName}</h2>}</div>

      <div className="UserSettings__drawers">
        <Drawer
          id="profile"
          title="Profile"
          summary={
            user?.timezone ? `${user.displayName ?? ""} · ${user.timezone}` : "set your timezone"
          }
          defaultOpen
        >
          <ProfileSection />
        </Drawer>

        <Drawer id="account" title="Account" summary={user?.email}>
          <AccountSection />
        </Drawer>

        <Drawer
          id="achievements"
          title="Achievements"
          summary={`${orderedAchievements.length} unlocked`}
        >
          <AchievementsSection achievements={orderedAchievements} />
        </Drawer>

        <Drawer
          id="logs"
          title="My logs"
          summary={myLogsHint({
            financial: ledgers.length,
            ongoing: ongoing.length,
            upcoming: upcoming.length,
            past: past.length,
            archived: archivedCount,
          })}
        >
          <MyLogsSection
            ledgers={ledgers}
            ongoing={ongoing}
            upcoming={upcoming}
            past={past}
            archivedGroups={archivedGroups}
            archivedLedgers={archivedLedgers}
          />
        </Drawer>
      </div>
    </div>
  );
};
