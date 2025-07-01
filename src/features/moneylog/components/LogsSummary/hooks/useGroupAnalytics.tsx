import { useMemo } from "react"
import dayjs from "dayjs"
import { Currency, Group, LogPost, User } from "@/types/user"
import { FullUserData } from "@/hooks/useGetGroupUsers"

// Types for group analytics
interface UserSpendingProfile {
  userId: string
  userName: string
  weeklyAverages: Map<Currency, number>
  dailyAverages: Map<Currency, number>
  totalSpent: Map<Currency, number>
}

interface GroupAnalytics {
  currencyPercentiles: Map<Currency, { p25: number, p50: number, p75: number }>
  userRankings: Map<Currency, Array<{ userId: string, userName: string, dailyAverage: number, weeklyAverage: number }>>
  groupTotals: Map<Currency, number>
  activeDaysRange: { start: dayjs.Dayjs, end: dayjs.Dayjs }
}

// Utility function to calculate percentiles
const calculatePercentiles = (values: number[]): { p25: number, p50: number, p75: number } => {
  if (values.length === 0) return { p25: 0, p50: 0, p75: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const getPercentile = (p: number) => {
    const index = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower

    if (upper >= sorted.length) return sorted[sorted.length - 1]
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  return {
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75)
  }
}

// Calculate individual user's spending profile
const calculateUserProfile = (userId: string, userName: string, userPosts: LogPost[], dateRange: { start: dayjs.Dayjs, end: dayjs.Dayjs }): UserSpendingProfile => {
  let totalSpent = new Map<Currency, number>()
  let dailyTotals = new Map<string, Map<Currency, number>>()
  let weeklyTotals = new Map<string, Map<Currency, number>>()

  // Process each post
  userPosts.forEach(post => {
    const currency = post.currency
    const postDate = dayjs(post.postDate.seconds * 1000)

    // Add to total
    totalSpent.set(currency, (totalSpent.get(currency) || 0) + post.amount)

    // Daily aggregation
    const dayKey = postDate.format('YYYY-MM-DD')
    if (!dailyTotals.has(dayKey)) {
      dailyTotals.set(dayKey, new Map<Currency, number>())
    }
    const dailyMap = dailyTotals.get(dayKey)!
    dailyMap.set(currency, (dailyMap.get(currency) || 0) + post.amount)

    // Weekly aggregation (Monday-based weeks)
    const dayOfWeek = postDate.day() === 0 ? 6 : postDate.day() - 1
    const mondayOfWeek = postDate.subtract(dayOfWeek, 'day')
    const weekKey = mondayOfWeek.format('YYYY-MM-DD')

    if (!weeklyTotals.has(weekKey)) {
      weeklyTotals.set(weekKey, new Map<Currency, number>())
    }
    const weeklyMap = weeklyTotals.get(weekKey)!
    weeklyMap.set(currency, (weeklyMap.get(currency) || 0) + post.amount)
  })

  // Calculate averages
  const weeklyAverages = new Map<Currency, number>()
  const dailyAverages = new Map<Currency, number>()

  // Get all currencies this user has spent in
  const currencies = new Set([...totalSpent.keys()])

  currencies.forEach(currency => {
    const total = totalSpent.get(currency) || 0

    // Count weeks with activity for this currency
    const activeWeeks = [...weeklyTotals.values()]
      .filter(weekMap => weekMap.has(currency))
      .length

    // Count days with activity for this currency
    const activeDays = [...dailyTotals.values()]
      .filter(dayMap => dayMap.has(currency))
      .length

    if (activeWeeks > 0) {
      weeklyAverages.set(currency, total / activeWeeks)
    }

    if (activeDays > 0) {
      dailyAverages.set(currency, total / activeDays)
    }
  })

  return {
    userId,
    userName,
    weeklyAverages,
    dailyAverages,
    totalSpent
  }
}

// Main function to calculate group analytics
export const calculateGroupAnalytics = (
  logPosts: LogPost[],
  group: Group,
  groupMembers: FullUserData[] // You'll need to pass this from your component
): GroupAnalytics => {
  // Determine active date range
  const postDates = logPosts.map(post => dayjs(post.postDate.seconds * 1000))
  const activeDaysRange = {
    start: postDates.length > 0 ? dayjs.min(postDates)! : dayjs(group.start.seconds * 1000),
    end: postDates.length > 0 ? dayjs.max(postDates)! : dayjs(group.end.seconds * 1000)
  }

  // Calculate each user's profile
  const userProfiles: UserSpendingProfile[] = groupMembers.map(member => {
    const userPosts = logPosts.filter(post => post.author.id === member.id)
    return calculateUserProfile(member.id, member.displayName, userPosts, activeDaysRange)
  })

  // Get all currencies used in the group
  const allCurrencies = new Set<Currency>()
  userProfiles.forEach(profile => {
    profile.dailyAverages.forEach((_, currency) => allCurrencies.add(currency))
  })

  // Calculate percentiles and rankings per currency
  const currencyPercentiles = new Map<Currency, { p25: number, p50: number, p75: number }>()
  const userRankings = new Map<Currency, Array<{ userId: string, userName: string, dailyAverage: number, weeklyAverage: number }>>()
  const groupTotals = new Map<Currency, number>()

  allCurrencies.forEach(currency => {
    // Collect daily averages for percentile calculation
    const dailyAverages = userProfiles
      .map(profile => profile.dailyAverages.get(currency) || 0)
      .filter(avg => avg > 0) // Only include users who actually spent in this currency

    // Calculate percentiles
    currencyPercentiles.set(currency, calculatePercentiles(dailyAverages))

    // Create rankings (sorted by daily average, descending)
    const rankings = userProfiles
      .map(profile => ({
        userId: profile.userId,
        userName: profile.userName,
        dailyAverage: profile.dailyAverages.get(currency) || 0,
        weeklyAverage: profile.weeklyAverages.get(currency) || 0
      }))
      .filter(user => user.dailyAverage > 0) // Only include users with spending in this currency
      .sort((a, b) => b.dailyAverage - a.dailyAverage) // Highest spenders first

    userRankings.set(currency, rankings)

    // Calculate group total
    const groupTotal = userProfiles.reduce((sum, profile) =>
      sum + (profile.totalSpent.get(currency) || 0), 0
    )
    groupTotals.set(currency, groupTotal)
  })

  return {
    currencyPercentiles,
    userRankings,
    groupTotals,
    activeDaysRange
  }
}

// Hook to use group analytics in your component
export const useGroupAnalytics = (logPosts: LogPost[], group: Group, groupMembers: FullUserData[]) => {
  return useMemo(() => {
    return calculateGroupAnalytics(logPosts, group, groupMembers)
  }, [logPosts, group, groupMembers])
}

// Helper component to display group analytics (optional - for debugging/admin views)
export const GroupAnalyticsDebug = ({ analytics }: { analytics: GroupAnalytics }) => {
  return (
    <div className="GroupAnalytics">
      <h4>Group Analytics Debug</h4>

      {[...analytics.currencyPercentiles.entries()].map(([currency, percentiles]) => (
        <div key={`analytics-${currency}`}>
          <h5>{currency}</h5>
          <p>25th percentile: {percentiles.p25.toFixed(2)}</p>
          <p>50th percentile (median): {percentiles.p50.toFixed(2)}</p>
          <p>75th percentile: {percentiles.p75.toFixed(2)}</p>

          <h6>Rankings:</h6>
          <ol>
            {(analytics.userRankings.get(currency) || []).map(user => (
              <li key={`ranking-${currency}-${user.userId}`}>
                {user.userName}: {user.dailyAverage.toFixed(2)} daily avg
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}