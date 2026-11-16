import { Link } from "react-router-dom";

import { ACHIEVEMENT_META, HeldAchievement, isCoinAchievement } from "@/hooks/useAchievements";
import Icon from "@/components/Icon";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import { COIN_ACHIEVEMENTS } from "@/features/ledger/buddy/knickknacks/coinAchievements";

import "@/features/moneylog/components/LogsSummary/styles.scss";

type AchievementsSectionProps = {
  /** Already ordered by the caller (most recently ended group first). */
  achievements: ReadonlyArray<HeldAchievement>;
};

export const AchievementsSection = ({ achievements }: AchievementsSectionProps) => {
  if (achievements.length === 0) {
    return (
      <p className="GroupArchive__empty">
        No achievements yet. They are awarded when a log group ends, and for keeping up a financial
        log.
      </p>
    );
  }

  return (
    <div className="AchievementsList">
      {achievements.map((achievement) => {
        if (isCoinAchievement(achievement)) {
          // Coins aren't tied to one log, so the tile isn't a link.
          const coin = COIN_ACHIEVEMENTS[achievement.type];
          return (
            <div
              key={achievement.id}
              className="AchievementsList__item AchievementsList__item--coin"
              aria-label={`${coin.title}: ${coin.description}`}
            >
              <span className="AchievementsList__item__icon" aria-hidden="true">
                <KnickKnack id={achievement.type} size={64} />
              </span>
              <div className="AchievementsList__item__text">
                <strong>{coin.title}</strong>
                <span>{coin.description}</span>
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
