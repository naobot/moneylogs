import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useLogActivity } from "@/hooks/useLogActivity";
import { useLedgerMonthTotals } from "@/hooks/useLedgerMonthTotals";
import { Group } from "@/types/user";
import { Ledger } from "@/types/ledger";
import { arrangeDashboard, groupTiming, memberLabel } from "@/utils/dashboard";
import { formatMonth, monthKeyOf, todayInTz } from "@/utils/ledger";
import { formatTotals } from "@/utils/ledgerEntries";
import { formatNewCount } from "@/utils/logActivity";

import { DashboardFriends } from "./DashboardFriends";
import { KnickKnackDrawer } from "./KnickKnackDrawer";
import { LogCard } from "./LogCard";

import "./Dashboard.scss";

type DashboardProps = {
  groups: ReadonlyArray<Group>;
  ledgers: ReadonlyArray<Ledger>;
};

/**
 * Home's gallery. What's current gets big cards with live previews (new activity since
 * your last visit; this month's spending for financial logs). Upcoming groups get smaller
 * cards, and only the few most recently ended groups appear, as a compact strip. The
 * knick-knack drawer sits in a thinner right-hand column on wider screens, and below
 * everything else on narrow ones.
 */
export const Dashboard = ({ groups, ledgers }: DashboardProps) => {
  const { user } = useCurrentUser();
  const { now, upcoming, recent, pastCount } = arrangeDashboard({ groups, ledgers, user });
  const { activity } = useLogActivity({ groups, ledgers });

  const currentLedgers = now.flatMap((item) =>
    item.kind === "financial" ? [item.ledger, ...item.sublogs] : [],
  );
  const month = monthKeyOf(todayInTz(user?.timezone));
  const totals = useLedgerMonthTotals(
    currentLedgers.map((l) => l.id),
    month,
  );

  const badgeFor = (id: string, kind: "social" | "financial") => {
    const count = activity[id];
    return count ? formatNewCount(count, kind) : undefined;
  };

  const monthLine = (ledgerId: string) => {
    const monthTotals = totals[ledgerId];
    if (monthTotals === undefined) return `${formatMonth(month)}: …`;
    if (monthTotals === null) return null;
    return `${formatMonth(month)}: ${formatTotals(monthTotals) || "nothing yet"}`;
  };

  // A financial log's card: a parent's lists its sublogs, a sublog's is smaller.
  const ledgerCard = (
    ledger: Ledger,
    { sublog = false, sublogCount = 0 }: { sublog?: boolean; sublogCount?: number } = {},
  ) => {
    const shared = (ledger.memberUids?.length ?? 0) > 1;
    const kind = sublog ? "sublog" : "financial";
    return (
      <LogCard
        key={ledger.id}
        to={`/l/${ledger.id}`}
        title={ledger.title}
        size={sublog ? "small" : "large"}
        kind={shared ? `${kind} · shared` : kind}
        details={[
          monthLine(ledger.id),
          sublog ? null : memberLabel(ledger.memberUids?.length ?? 0),
          sublogCount > 0 ? `incl. ${sublogCount} sublog${sublogCount > 1 ? "s" : ""}` : null,
        ].filter((line): line is string => !!line)}
        badge={badgeFor(ledger.id, "financial")}
      />
    );
  };

  return (
    <div className="Dashboard Dashboard--split">
      <div className="Dashboard__main">
        <section className="Dashboard__section" aria-labelledby="dashboard-now">
          <div className="Dashboard__heading">
            <h3 id="dashboard-now">Now</h3>
            <Link to="/create" className="Dashboard__action">
              + start a new log
            </Link>
          </div>
          {now.length > 0 ? (
            <div className="Dashboard__grid Dashboard__grid--large">
              {now.map((item) =>
                item.kind === "social" ? (
                  <LogCard
                    key={item.id}
                    to={`/g/${item.id}`}
                    title={item.group.title}
                    size="large"
                    kind="log group"
                    details={[
                      groupTiming(item.group, "ongoing", user?.timezone),
                      memberLabel(item.group.members?.length ?? 0),
                    ]}
                    badge={badgeFor(item.id, "social")}
                  />
                ) : item.sublogs.length > 0 ? (
                  // A parent with its sublogs hung under it on a tree line.
                  <div key={item.id} className="Dashboard__family">
                    {ledgerCard(item.ledger, { sublogCount: item.sublogs.length })}
                    <ul
                      className="Dashboard__family__kids"
                      aria-label={`${item.ledger.title}'s sublogs`}
                    >
                      {item.sublogs.map((sublog) => (
                        <li key={sublog.id} className="Dashboard__family__kid">
                          {ledgerCard(sublog, { sublog: true })}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  ledgerCard(item.ledger)
                ),
              )}
            </div>
          ) : (
            <p className="GroupArchive__empty">Nothing ongoing right now.</p>
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="Dashboard__section" aria-labelledby="dashboard-upcoming">
            <h3 id="dashboard-upcoming">Coming up</h3>
            <div className="Dashboard__grid Dashboard__grid--small">
              {upcoming.map((group) => (
                <LogCard
                  key={group.id}
                  to={`/g/${group.id}`}
                  title={group.title}
                  size="small"
                  details={[groupTiming(group, "upcoming", user?.timezone)]}
                />
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section className="Dashboard__section" aria-labelledby="dashboard-recent">
            <div className="Dashboard__heading">
              <h3 id="dashboard-recent">Recently ended</h3>
              <Link to="/me#logs" className="Dashboard__action">
                see all{pastCount > recent.length ? ` ${pastCount}` : ""} in{" "}
                <strong>my logs</strong> →
              </Link>
            </div>
            <div className="Dashboard__grid Dashboard__grid--compact">
              {recent.map((group) => (
                <LogCard
                  key={group.id}
                  to={`/g/${group.id}`}
                  title={group.title}
                  size="compact"
                  details={[groupTiming(group, "past", user?.timezone)]}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="Dashboard__side">
        <DashboardFriends />
        <KnickKnackDrawer />
      </aside>
    </div>
  );
};

export default Dashboard;
