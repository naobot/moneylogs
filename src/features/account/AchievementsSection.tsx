import { Link } from "react-router-dom";

import {
  ACHIEVEMENT_META,
  HeldAchievement,
  isEngagementAchievement,
  isMilestoneAchievement,
} from "@/hooks/useAchievements";
import Icon from "@/components/Icon";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import { MILESTONE_ACHIEVEMENTS } from "@/features/ledger/buddy/knickknacks/milestoneAchievements";
import { ENGAGEMENT_ACHIEVEMENTS } from "@/utils/engagementAchievements";

import "@/features/moneylog/components/LogsSummary/styles.scss";

type AchievementsSectionProps = {
  /** Already ordered by the caller (most recently ended group first). */
  achievements: ReadonlyArray<HeldAchievement>;
};

export const AchievementsSection = ({ achievements }: AchievementsSectionProps) => {
  if (achievements.length === 0) {
    return (
      <p className="GroupArchive__empty">
        No achievements yet. They are awarded when a log group ends, for habits like keeping up a
        financial log, and for trying things like gifting a knick-knack.
      </p>
    );
  }

  return (
    <div className="AchievementsList">
      {achievements.map((achievement) => {
        if (isMilestoneAchievement(achievement)) {
          // Milestones aren't tied to one log, so the tile isn't a link.
          const milestone = MILESTONE_ACHIEVEMENTS[achievement.type];
          return (
            <div
              key={achievement.id}
              className="AchievementsList__item AchievementsList__item--milestone"
              aria-label={`${milestone.title}: ${milestone.description}`}
            >
              <span className="AchievementsList__item__icon" aria-hidden="true">
                <KnickKnack id={achievement.type} size={64} />
              </span>
              <div className="AchievementsList__item__text">
                <strong>{milestone.title}</strong>
                <span>{milestone.description}</span>
              </div>
            </div>
          );
        }
        if (isEngagementAchievement(achievement)) {
          // Not tied to one log either, so not a link.
          const engagement = ENGAGEMENT_ACHIEVEMENTS[achievement.type];
          return (
            <div
              key={achievement.id}
              className="AchievementsList__item"
              aria-label={`${engagement.title}: ${engagement.description}`}
            >
              <span className="AchievementsList__item__icon" aria-hidden="true">
                <Icon type={engagement.icon} />
              </span>
              <div className="AchievementsList__item__text">
                <strong>{engagement.title}</strong>
                <span>{engagement.description}</span>
              </div>
            </div>
          );
        }
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
  );
};

export default AchievementsSection;
