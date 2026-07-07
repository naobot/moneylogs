import { ReactNode, useMemo, useState } from "react";
import { Currency, Group, LogPost } from "@/types/user";
import { FullUserData } from "@/hooks/useGetGroupUsers";
import Button from "@/components/Button";
import SpendingInsights from "./SpendingInsights";
import SpendingChart from "./SpendingChart";
import PostPreview from "./PostPreview";
import { autoGranularity, buildSpendingSeries } from "./spendingSeries";

type Scope = "mine" | "group" | "other";
type ChartMode = "bars" | "cumulative";

interface GroupAnalytics {
  currencyPercentiles: Map<Currency, { p25: number; p50: number; p75: number }>;
}

interface SpendingPanelProps {
  user: Partial<FullUserData>;
  logPosts: LogPost[];
  group: Group;
  scope: Scope;
  groupAnalytics?: GroupAnalytics;
}

const fmt = (value: number, currency: Currency) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;

const insightsChildren = (scope: Scope, groupAnalytics?: GroupAnalytics): ReactNode => {
  if (scope === "group") {
    return (
      <>
        <SpendingInsights.TotalText>
          The group spent a <strong>total of</strong>
        </SpendingInsights.TotalText>
        <SpendingInsights.WeekText>
          The group <strong>spent the most</strong> during the <strong>weeks of</strong>
        </SpendingInsights.WeekText>
        <SpendingInsights.DayText showPosts={true} showAuthors={true} showMultipleDays={true}>
          The <strong>days the group spent the most</strong> were
        </SpendingInsights.DayText>
      </>
    );
  }

  const subject = scope === "mine" ? "You" : "This user";
  const possessive = scope === "mine" ? "your" : "this user's";
  return (
    <>
      <SpendingInsights.TotalText>
        {subject} spent a <strong>total of</strong>
      </SpendingInsights.TotalText>
      <SpendingInsights.WeekText>
        {subject} <strong>spent the most</strong> during the <strong>week(s) of</strong>
      </SpendingInsights.WeekText>
      <SpendingInsights.DayText showPosts={true} showAuthors={scope === "other"}>
        The <strong>{scope === "mine" ? "day you spent the most" : "most expensive day"}</strong>{" "}
        was
      </SpendingInsights.DayText>
      <SpendingInsights.AveragesText>
        Here are {possessive} average <strong>spending patterns</strong>:
      </SpendingInsights.AveragesText>
      <SpendingInsights.WeekendWeekdayText>{""}</SpendingInsights.WeekendWeekdayText>
      <SpendingInsights.NoSpendDaysText>
        {subject} logged <strong>no spending</strong> on
      </SpendingInsights.NoSpendDaysText>
      <SpendingInsights.LowSpenderAlert groupAnalytics={groupAnalytics}>
        <strong>Good news!</strong>
      </SpendingInsights.LowSpenderAlert>
    </>
  );
};

const SpendingPanel = ({ user, logPosts, group, scope, groupAnalytics }: SpendingPanelProps) => {
  const granularity = useMemo(() => autoGranularity(group), [group]);
  const spending = useMemo(
    () => buildSpendingSeries(logPosts, group, { user, granularity }),
    [logPosts, group, user, granularity],
  );

  const [mode, setMode] = useState<ChartMode>("bars");
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { currencies } = spending;
  const activeCurrency =
    currency && currencies.includes(currency) ? currency : (currencies[0] ?? null);

  const points = activeCurrency ? (spending.series.get(activeCurrency) ?? []) : [];
  const selectedPoint = selectedKey ? points.find((p) => p.key === selectedKey) : undefined;

  return (
    <div className="SpendingPanel">
      {currencies.length === 0 || !activeCurrency ? (
        <p className="SpendingPanel__empty">No spending was logged in this period.</p>
      ) : (
        <>
          <div className="SpendingPanel__controls">
            <div className="Segmented" role="group" aria-label="Graph type">
              <Button
                text="bars"
                size="sm"
                buttonStyle="primary-border"
                isSelected={mode === "bars"}
                onClick={() => setMode("bars")}
              />
              <Button
                text="cumulative"
                size="sm"
                buttonStyle="primary-border"
                isSelected={mode === "cumulative"}
                onClick={() => setMode("cumulative")}
              />
            </div>

            {currencies.length > 1 && (
              <div className="Segmented" role="group" aria-label="Currency">
                {currencies.map((c) => (
                  <Button
                    key={c}
                    text={c}
                    size="sm"
                    buttonStyle="primary-border"
                    isSelected={c === activeCurrency}
                    onClick={() => {
                      setCurrency(c);
                      setSelectedKey(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <SpendingChart
            series={points}
            mode={mode}
            currency={activeCurrency}
            selectedKey={selectedKey}
            onSelectPoint={(p) => setSelectedKey((k) => (k === p.key ? null : p.key))}
          />

          {selectedPoint && selectedPoint.posts.length > 0 && (
            <div className="SpendingPanel__daydetail">
              <p>
                <strong>{selectedPoint.label}</strong> — {fmt(selectedPoint.amount, activeCurrency)}
              </p>
              <div className="LogsSummary__ScrollList">
                {[...selectedPoint.posts]
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 10)
                  .map((post) => (
                    <PostPreview key={`sel-${post.id}`} post={post} showAuthor={scope !== "mine"} />
                  ))}
              </div>
            </div>
          )}

          <SpendingInsights
            user={user}
            logPosts={logPosts}
            group={group}
            groupAnalytics={groupAnalytics}
          >
            {insightsChildren(scope, groupAnalytics)}
          </SpendingInsights>
        </>
      )}
    </div>
  );
};

export default SpendingPanel;
