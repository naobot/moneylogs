import { useMemo } from "react"
import { useCurrentUser } from "@/contexts"
import { Group, LogPost } from "@/types/user"

import { FullUserData } from "@/hooks/useGetGroupUsers"
import { useGroupAnalytics } from "./hooks/useGroupAnalytics"

import SpendingInsights from "./SpendingInsights"

import './styles.scss'

interface LogsSummaryProps {
  group: Group
  logPosts: Array<LogPost>
  groupMembers: FullUserData[]
}

const LogsSummary = ({ group, groupMembers, logPosts }: LogsSummaryProps) => {
  const { user: loggedInUser } = useCurrentUser()

  const groupAnalytics = useGroupAnalytics(logPosts, group, groupMembers)

  const myLogs = useMemo(() => {
    return logPosts.filter(logPost => logPost.author.id === loggedInUser?.id)
  }, [logPosts, loggedInUser?.id])

  return (
    <>
      <div className="LogsSummary">
        <h2>Insights for {group.title}</h2>

        <div className="Window">
          <h3>{loggedInUser?.displayName}'s spending</h3>
          <SpendingInsights logPosts={myLogs} group={group}>
            <SpendingInsights.TotalText>
              You spent a <strong>total of</strong>
            </SpendingInsights.TotalText>

            <SpendingInsights.WeekText>
              You <strong>spent the most</strong> during the <strong>week(s) of</strong>
            </SpendingInsights.WeekText>

            <SpendingInsights.DayText showPosts={true}>
              The <strong>day you spent the most</strong> was
            </SpendingInsights.DayText>

            <SpendingInsights.AveragesText>
              Here are your average <strong>spending patterns</strong>:
            </SpendingInsights.AveragesText>

            <SpendingInsights.WeekendWeekdayText>
              {''}
            </SpendingInsights.WeekendWeekdayText>

            <SpendingInsights.NoSpendDaysText>
              You had <strong>no spending</strong> on
            </SpendingInsights.NoSpendDaysText>

            <SpendingInsights.LowSpenderAlert groupAnalytics={groupAnalytics}>
              💡 <strong>Good news!</strong>
            </SpendingInsights.LowSpenderAlert>
          </SpendingInsights>
        </div>

        <div className="Window">
          <h3>Group spending</h3>
          <SpendingInsights logPosts={logPosts} group={group}>
            <SpendingInsights.TotalText>
              The group spent a <strong>total of</strong>
            </SpendingInsights.TotalText>

            <SpendingInsights.WeekText>
              The group <strong>spent the most</strong> during the <strong>weeks of</strong>
            </SpendingInsights.WeekText>

            <SpendingInsights.DayText showPosts={true} showAuthors={true} showMultipleDays={true}>
              The <strong>days the group spent the most</strong> were
            </SpendingInsights.DayText>
          </SpendingInsights>
        </div>
      </div>

      <div className="LogsSummaryRight">
        {/* right side content */}
      </div>
    </>
  )
}

export default LogsSummary