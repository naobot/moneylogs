import { Achievement, ACHIEVEMENT_META } from "@/hooks/useAchievements";
import Icon from "@/components/Icon";

const AchievementsBanner = ({ achievements }: { achievements: Achievement[] }) => {
  if (achievements.length === 0) return null;

  return (
    <div className="AchievementsBanner Window">
      <h3 className="AchievementsBanner__heading">Achievement unlocked!</h3>
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
