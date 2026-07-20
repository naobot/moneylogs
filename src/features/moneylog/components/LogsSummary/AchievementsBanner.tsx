import { Achievement, ACHIEVEMENT_META } from "@/hooks/useAchievements";
import Icon from "@/components/Icon";

type AchievementsBannerProps = {
  achievements: Achievement[];
  // True only on the visit that actually earned something, so the celebratory
  // heading doesn't persist on every later view of the same summary.
  hasNewlyUnlocked?: boolean;
};

const AchievementsBanner = ({ achievements, hasNewlyUnlocked }: AchievementsBannerProps) => {
  if (achievements.length === 0) return null;

  return (
    <div className="AchievementsBanner Window">
      <h3 className="AchievementsBanner__heading">
        {hasNewlyUnlocked ? "Achievement unlocked!" : "Achievements"}
      </h3>
      <div className="AchievementsBanner__cards">
        {achievements.map((achievement) => {
          const meta = ACHIEVEMENT_META[achievement.type];
          return (
            <div key={achievement.id} className="AchievementsBanner__card">
              <span className="AchievementsBanner__card__icon" aria-hidden="true">
                <Icon type={meta.icon} />
              </span>
              <div className="AchievementsBanner__card__text">
                <strong>{meta.title}</strong>
                <span>{meta.description(achievement.currency)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementsBanner;
