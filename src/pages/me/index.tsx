import cx from "classnames";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTimezoneSelect, allTimezones } from "react-timezone-select";

import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useMutation } from "@/hooks/useFirebase";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useReadTracking } from "@/hooks/useReadTracking";
import { useGetAchievements, ACHIEVEMENT_META } from "@/hooks/useAchievements";

import Button from "@/components/Button";
import ControlledInput from "@/components/ControlledInput";
import Icon from "@/components/Icon";

import "./me.scss";
import "@/features/moneylog/components/LogsSummary/styles.scss";
import GroupArchive from "@/features/moneylog/components/GroupArchive";
import dayjs from "dayjs";
import { absoluteStart, absoluteEnd } from "@/utils/groupBoundaries";

export const UserSettings = () => {
  const { allGroups, isSuccess } = useGetCurrentGroups();

  const { showToast } = useToastContext();
  const { trackUserAction } = useReadTracking();
  const { user } = useCurrentUser();
  const { achievements } = useGetAchievements(user?.id);
  const { options, parseTimezone } = useTimezoneSelect({
    labelStyle: "original",
    timezones: allTimezones,
  });

  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDisplayLocation, setNewDisplayLocation] = useState("");
  const [newTimezone, setNewTimezone] = useState<string>();

  const isSubmittable = useMemo(() => {
    return !!user?.userId && !!newTimezone;
  }, [user?.userId, newTimezone]);

  const { updateUserProfile } = useUserQuery();

  const { mutate: updateUserInfo, isLoading: createPending } = useMutation(
    async (userData: {
      userId: string;
      displayName: string;
      displayLocation?: string;
      timezone: string;
    }) => {
      await updateUserProfile.mutate(userData);

      trackUserAction("update_user_profile", {
        user_id: user?.id,
      });

      return;
    },
  );

  useEffect(() => {
    if (user?.displayName) {
      setNewDisplayName(user?.displayName);
    }
    if (user?.displayLocation) {
      setNewDisplayLocation(user?.displayLocation);
    }
    if (user?.timezone) {
      setNewTimezone(user?.timezone);
    }
  }, [user]);

  const handleUpdateUserInfo = async () => {
    if (!user?.userId || !newTimezone) return;

    try {
      await updateUserInfo({
        userId: user?.id,
        displayName: newDisplayName,
        displayLocation: newDisplayLocation ?? undefined,
        timezone: newTimezone,
      });

      showToast("Profile updated", "success");
    } catch (err) {
      console.error("Failed to update user info:", err);
      showToast("Failed to update profile. Please try again.");
    }
  };

  return (
    <div className="Window UserSettings">
      <div className="Window__heading">{user?.displayName && <h2>hi {user?.displayName}</h2>}</div>

      <div className="UserSettings__form">
        <ControlledInput
          onChange={(e) => setNewDisplayName((e.target as HTMLInputElement).value)}
          label="Display name"
          value={newDisplayName}
        />

        <ControlledInput
          onChange={(e) => setNewDisplayLocation((e.target as HTMLInputElement).value)}
          label="Display location"
          value={newDisplayLocation}
        />

        {newDisplayName.length > 0 && (
          <p>
            Your name will display as{" "}
            <strong>
              {newDisplayName} {newDisplayLocation.length > 0 && <>({newDisplayLocation})</>}
            </strong>
          </p>
        )}

        <div
          className={cx("ControlledInput", {
            "ControlledInput--warning": !newTimezone,
          })}
        >
          <label>My timezone is</label>
          <select
            onChange={(e) => {
              parseTimezone(e.currentTarget.value);
              setNewTimezone(e.currentTarget.value);
            }}
            value={newTimezone}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="Menu">
        <Button
          text="Set my user profile"
          size="lg"
          buttonStyle="primary-border"
          disabled={!isSubmittable}
          loading={createPending}
          onClick={handleUpdateUserInfo}
        />
      </div>

      {achievements.length > 0 && (
        <div>
          <h3>Achievements</h3>
          <div className="AchievementsList">
            {achievements.map((achievement) => {
              const meta = ACHIEVEMENT_META[achievement.type];
              return (
                <Link
                  key={achievement.id}
                  to={`/g/${achievement.groupId}`}
                  className="AchievementsList__item"
                  aria-label={`${meta.title} — unlocked on ${achievement.groupTitle}`}
                >
                  <span className="AchievementsList__item__icon" aria-hidden="true">
                    <Icon type={meta.icon} />
                  </span>
                  <div className="AchievementsList__item__text">
                    <strong>
                      {meta.title}
                      {achievement.currency ? ` · ${achievement.currency}` : ""}
                    </strong>
                    <span>{achievement.groupTitle}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {isSuccess &&
        allGroups.length > 0 && ( // TODO improve this area lol
          <div>
            <h3>Upcoming groups</h3>
            <GroupArchive
              groups={allGroups.filter((g) => absoluteStart(g).isAfter(dayjs()))}
              emptyMessage="You have no upcoming log groups."
            />
            <h3>Past groups</h3>
            <GroupArchive groups={allGroups.filter((g) => absoluteEnd(g).isBefore(dayjs()))} />
          </div>
        )}
    </div>
  );
};
