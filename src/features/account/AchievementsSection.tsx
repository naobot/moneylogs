import { Link } from "react-router-dom";

import { Achievement, ACHIEVEMENT_META } from "@/hooks/useAchievements";
import Icon from "@/components/Icon";

import "@/features/moneylog/components/LogsSummary/styles.scss";

type AchievementsSectionProps = {
  /** Already ordered by the caller (most recently ended group first). */
  achievements: ReadonlyArray<Achievement>;
};

export const AchievementsSection = ({ achievements }: AchievementsSectionProps) => {
  if (achievements.length === 0) {
    return (
      <p className="GroupArchive__empty">
        No achievements yet. They are awarded when a log group ends.
      </p>
    );
  }

  return (
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
  );
};

export default AchievementsSection;
