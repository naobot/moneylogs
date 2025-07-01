import { useMemo, createContext, useContext, ReactNode } from "react"
import dayjs from "dayjs"
import MDEditor from "@uiw/react-md-editor"

import { Currency, Group, LogPost } from "@/types/user"
import Icon from "@/components/Icon"

interface SpendingData {
  totalSpent: Map<Currency, number>
  expensiveWeek: Map<Currency, { week: string, amount: number }>
  expensiveDay: Map<Currency, { day: string, amount: number, posts: LogPost[] }>
  // New analytics
  weeklyAverages: Map<Currency, number>
  dailyAverages: Map<Currency, number>
  weekendVsWeekdayDiff: Map<Currency, { weekendAvg: number, weekdayAvg: number, difference: number }>
  noSpendDays: number
  totalDaysInPeriod: number
  group: Group
}

// New interface for group-wide analytics (passed from parent)
interface GroupAnalytics {
  currencyPercentiles: Map<Currency, { p25: number, p50: number, p75: number }>
}

const SpendingContext = createContext<SpendingData | null>(null)

const useSpendingData = () => {
  const context = useContext(SpendingContext)
  if (!context) {
    throw new Error('Spending components must be used within SpendingInsights')
  }
  return context
}

interface SpendingInsightsProps {
  logPosts: Array<LogPost>
  group: Group
  groupAnalytics?: GroupAnalytics // Optional for now, for low-spender detection
  children: ReactNode
}

const SpendingInsights = ({ logPosts, group, groupAnalytics, children }: SpendingInsightsProps) => {
  const spendingData = useMemo(() => {
    let totalSpent = new Map<Currency, number>()
    let weeklyTotals = new Map<string, { currencyMap: Map<Currency, number>, date: dayjs.Dayjs }>()
    let dailyTotals = new Map<string, { currencyMap: Map<Currency, number>, date: dayjs.Dayjs, posts: LogPost[] }>()

    // New: Weekend vs weekday tracking
    let weekendTotals = new Map<Currency, { totalAmount: number, dayCount: number }>()
    let weekdayTotals = new Map<Currency, { totalAmount: number, dayCount: number }>()

    logPosts.forEach(log => {
      const currency = log.currency
      const postDate = dayjs(log.postDate.seconds * 1000) // Convert Firebase Timestamp
      const logPost = log

      // Calculate total spent
      let prevTotal = totalSpent.get(currency) || 0
      totalSpent.set(currency, prevTotal + Number(log.amount))

      // Generate keys for grouping - Monday as day 0
      const dayOfWeek = postDate.day() === 0 ? 6 : postDate.day() - 1 // Convert Sunday=0 to Sunday=6, others shift down by 1
      const mondayOfWeek = postDate.subtract(dayOfWeek, 'day')
      const weekKey = mondayOfWeek.format('YYYY-MM-DD') // Use Monday's date as week key
      const dayKey = postDate.format('YYYY-MM-DD')

      // Track weekly totals
      if (!weeklyTotals.has(weekKey)) {
        weeklyTotals.set(weekKey, {
          currencyMap: new Map<Currency, number>(),
          date: mondayOfWeek
        })
      }
      const weekData = weeklyTotals.get(weekKey)!
      weekData.currencyMap.set(currency, (weekData.currencyMap.get(currency) || 0) + Number(log.amount))

      // Track daily totals
      if (!dailyTotals.has(dayKey)) {
        dailyTotals.set(dayKey, {
          currencyMap: new Map<Currency, number>(),
          date: postDate,
          posts: [],
        })
      }
      const dayData = dailyTotals.get(dayKey)!
      dayData.currencyMap.set(currency, (dayData.currencyMap.get(currency) || 0) + Number(log.amount))
      dayData.posts = [...dayData.posts, logPost]

      // New: Weekend vs weekday tracking
      const isWeekend = postDate.day() === 0 || postDate.day() === 6 // Sunday or Saturday
      const targetMap = isWeekend ? weekendTotals : weekdayTotals

      if (!targetMap.has(currency)) {
        targetMap.set(currency, { totalAmount: 0, dayCount: 0 })
      }

      // Only count each day once per currency (aggregate daily totals first)
      const existingDayTotal = dailyTotals.get(dayKey)?.currencyMap.get(currency) || 0
      // We need to check if this is the first transaction for this day/currency combo
      const isFirstTransactionOfDay = (dailyTotals.get(dayKey)?.currencyMap.get(currency) || 0) === log.amount

      if (isFirstTransactionOfDay) {
        const currencyData = targetMap.get(currency)!
        currencyData.dayCount += 1
      }
    })

    // After processing all transactions, finalize weekend/weekday totals by day
    for (const [dayKey, dayData] of dailyTotals) {
      const isWeekend = dayData.date.day() === 0 || dayData.date.day() === 6
      const targetMap = isWeekend ? weekendTotals : weekdayTotals

      for (const [currency, dayAmount] of dayData.currencyMap) {
        if (!targetMap.has(currency)) {
          targetMap.set(currency, { totalAmount: 0, dayCount: 0 })
        }
        const currencyData = targetMap.get(currency)!
        currencyData.totalAmount += dayAmount
      }
    }

    // Find most expensive week per currency (existing logic)
    let expensiveWeek = new Map<Currency, { week: string, amount: number }>()
    for (const [weekKey, weekData] of weeklyTotals) {
      const weekStart = weekData.date
      const weekEnd = weekStart.add(6, 'day')
      const weekRange = `${weekStart.format('ddd D MMM YYYY')} to ${weekEnd.format('ddd D MMM YYYY')}`

      for (const [currency, amount] of weekData.currencyMap) {
        const current = expensiveWeek.get(currency)
        if (!current || amount > current.amount) {
          expensiveWeek.set(currency, { week: weekRange, amount })
        }
      }
    }

    // Find most expensive day per currency (existing logic)
    let expensiveDay = new Map<Currency, { day: string, amount: number, posts: LogPost[] }>()
    for (const [dayKey, dayData] of dailyTotals) {
      const dayFormatted = dayData.date.format('ddd D MMM YYYY')

      for (const [currency, amount] of dayData.currencyMap) {
        const current = expensiveDay.get(currency)
        if (!current || amount > current.amount) {
          expensiveDay.set(currency, { day: dayFormatted, amount, posts: dayData.posts })
        }
      }
    }

    // New: Calculate averages
    const weeklyAverages = new Map<Currency, number>()
    const dailyAverages = new Map<Currency, number>()
    const weekendVsWeekdayDiff = new Map<Currency, { weekendAvg: number, weekdayAvg: number, difference: number }>()

    // Get unique currencies
    const currencies = new Set([...totalSpent.keys()])

    currencies.forEach(currency => {
      const total = totalSpent.get(currency) || 0
      const weekCount = new Set([...weeklyTotals.keys()]).size
      const dayCount = dailyTotals.size > 0 ? new Set(
        [...dailyTotals.entries()]
          .filter(([_, dayData]) => dayData.currencyMap.has(currency))
          .map(([dayKey, _]) => dayKey)
      ).size : 0

      // Weekly average
      if (weekCount > 0) {
        weeklyAverages.set(currency, total / weekCount)
      }

      // Daily average
      if (dayCount > 0) {
        dailyAverages.set(currency, total / dayCount)
      }

      // Weekend vs weekday comparison
      const weekendData = weekendTotals.get(currency)
      const weekdayData = weekdayTotals.get(currency)

      if (weekendData && weekdayData && weekendData.dayCount > 0 && weekdayData.dayCount > 0) {
        const weekendAvg = weekendData.totalAmount / weekendData.dayCount
        const weekdayAvg = weekdayData.totalAmount / weekdayData.dayCount
        const difference = weekendAvg - weekdayAvg

        weekendVsWeekdayDiff.set(currency, {
          weekendAvg,
          weekdayAvg,
          difference
        })
      }
    })

    // New: Calculate no-spend days
    const groupStartDate = dayjs(group.start.seconds * 1000)
    const groupEndDate = dayjs(group.end.seconds * 1000)
    const totalDaysInPeriod = groupEndDate.diff(groupStartDate, 'day') + 1 // +1 to include both start and end dates

    // Count days with spending (any currency, any amount > 0)
    const daysWithSpending = dailyTotals.size
    const noSpendDays = totalDaysInPeriod - daysWithSpending

    return {
      totalSpent,
      expensiveWeek,
      expensiveDay,
      weeklyAverages,
      dailyAverages,
      weekendVsWeekdayDiff,
      noSpendDays,
      totalDaysInPeriod,
      group
    }
  }, [logPosts, group])

  return (
    <SpendingContext.Provider value={spendingData}>
      {children}
    </SpendingContext.Provider>
  )
}

// Existing components (unchanged)
const TotalText = ({ children }: { children: ReactNode }) => {
  const { totalSpent, group } = useSpendingData()

  return (
    <div className="LogsSummary__bubble">
      <p>
        {children}{' '}
        <span className="LogsSummary__highlight">
          {[...totalSpent.entries()]
            .filter(([currency, value]) => value > 0)
            .map(([currency, value]) => `${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`)
            .join(', ')
          }
        </span>
        <span> in total over the period of {dayjs(group.start.seconds * 1000).format('ddd D MMM YYYY')} to {dayjs(group.end.seconds * 1000).format('ddd D MMM YYYY')}</span>
      </p>
    </div>
  )
}

const WeekText = ({ children }: { children: ReactNode }) => {
  const { expensiveWeek } = useSpendingData()

  return (
    <div className="LogsSummary__bubble">
      {(() => {
        const expensiveWeeks = [...expensiveWeek.entries()].filter(([currency, value]) => value.amount > 0)

        if (expensiveWeeks.length === 1) {
          return (
            <p>{children}{' '}
              <span className="LogsSummary__highlight">{expensiveWeeks.map(([currency, value]) => `${value.week} (${value.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency})`)}</span>
            </p>
          )
        } else {
          return (
            <>
              <p>{children}...</p>
              <ul className="LogsSummary__List">{expensiveWeeks.map(([currency, value]) => <li key={`w-${currency}__${value.amount}`}>{`${value.week} (${value.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency})`}</li>)}</ul>
            </>
          )
        }
      })()}
    </div>
  )
}

const DayText = ({ children, showPosts = true, showAuthors = false, showMultipleDays = false }: { children: ReactNode, showPosts?: boolean, showAuthors?: boolean, showMultipleDays?: boolean }) => {
  const { expensiveDay } = useSpendingData()

  return (
    <div className="LogsSummary__bubble">
      {(() => {
        const expensiveDays = [...expensiveDay.entries()].filter(([currency, value]) => value.amount > 0)

        if (expensiveDays.length === 1) {
          return (
            <p>{children}{' '}
              <span className="LogsSummary__highlight">{expensiveDays.map(([currency, value]) => `${value.day} (${value.amount} ${currency})`)}</span>
            </p>
          )
        } else {
          return (
            <>
              <p>{children}...</p>
              <ul className="LogsSummary__List">{expensiveDays.map(([currency, value]) => <li key={`d-${currency}__${value.amount}`}>{`${value.day} (${value.amount} ${currency})`}</li>)}</ul>
            </>
          )
        }
      })()}

      {showPosts && (
        <>
          <p>
            <span>Some posts from that day...</span>
          </p>

          <div className="LogsSummary__ScrollList">
            {(() => {
              // Find the single most expensive day across all currencies
              const expensiveEntries = [...expensiveDay.entries()]
                .filter(([currency, value]) => value.amount > 0)

              if (expensiveEntries.length === 0) return null

              const mostExpensiveEntry = expensiveEntries.reduce((max, current) =>
                current[1].amount > max[1].amount ? current : max
              )

              const someExpensivePosts = expensiveEntries.map(x => x[1].posts).flat().filter(x => x.amount > 0)

              // Get posts to display (either from multiple days or single most expensive day)
              const postsToShow = showMultipleDays ? someExpensivePosts : mostExpensiveEntry[1].posts

              // Group posts by currency to handle comparison properly
              const postsByCurrency = new Map<Currency, LogPost[]>()
              postsToShow.forEach(post => {
                if (!postsByCurrency.has(post.currency)) {
                  postsByCurrency.set(post.currency, [])
                }
                postsByCurrency.get(post.currency)!.push(post)
              })

              // Get top posts per currency, then combine
              const topPostsPerCurrency: LogPost[] = []
              const postsPerCurrency = Math.max(1, Math.floor(10 / postsByCurrency.size)) // Distribute the 10 slots

              postsByCurrency.forEach((currencyPosts, currency) => {
                // Remove duplicates within this currency
                const uniqueCurrencyPosts = currencyPosts.filter((post, index, array) =>
                  array.findIndex(p => p.id === post.id) === index
                )

                // Sort by amount within currency and take top N for this currency
                const topForCurrency = uniqueCurrencyPosts
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, postsPerCurrency)

                topPostsPerCurrency.push(...topForCurrency)
              })

              // If we have leftover slots, fill them with the next highest from any currency
              if (topPostsPerCurrency.length < 10) {
                const remainingPosts = postsToShow
                  .filter(post => !topPostsPerCurrency.some(tp => tp.id === post.id))
                  .filter((post, index, array) => array.findIndex(p => p.id === post.id) === index) // dedupe

                // Sort remaining posts by relative rank within their currency
                const remainingWithRank = remainingPosts.map(post => {
                  const currencyPosts = postsByCurrency.get(post.currency) || []
                  const sortedCurrencyPosts = currencyPosts
                    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
                    .sort((a, b) => b.amount - a.amount)
                  const rank = sortedCurrencyPosts.findIndex(p => p.id === post.id)
                  return { post, rank, percentile: rank / sortedCurrencyPosts.length }
                })

                const additionalPosts = remainingWithRank
                  .sort((a, b) => a.percentile - b.percentile) // Best rank/percentile first
                  .slice(0, 10 - topPostsPerCurrency.length)
                  .map(x => x.post)

                topPostsPerCurrency.push(...additionalPosts)
              }

              const topExpensivePosts = topPostsPerCurrency

              return topExpensivePosts.map(post =>
                <div key={`PreviewPost__${post.id}`} className="PostPreview" data-color-mode="light">
                  <MDEditor.Markdown source={post.content} />
                  {showAuthors && <div className="PostPreview__footer"><Icon type={"user"} />{post.authorName}</div>}
                </div>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}

// New components for the additional analytics
const AveragesText = ({ children }: { children: ReactNode }) => {
  const { weeklyAverages, dailyAverages } = useSpendingData()

  return (
    <div className="LogsSummary__bubble">
      <p>{children}</p>

      {weeklyAverages.size > 0 && (
        <div>
          <strong>Weekly averages:</strong>{' '}
          <span className="LogsSummary__highlight">
            {[...weeklyAverages.entries()]
              .map(([currency, avg]) => `${avg.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`)
              .join(', ')
            }
          </span>
        </div>
      )}

      {dailyAverages.size > 0 && (
        <div>
          <strong>Daily averages:</strong>{' '}
          <span className="LogsSummary__highlight">
            {[...dailyAverages.entries()]
              .map(([currency, avg]) => `${avg.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`)
              .join(', ')
            }
          </span>
        </div>
      )}
    </div>
  )
}

const WeekendWeekdayText = ({ children }: { children: ReactNode }) => {
  const { weekendVsWeekdayDiff } = useSpendingData()

  if (weekendVsWeekdayDiff.size === 0) return

  return (
    <div className="LogsSummary__bubble">
      <p>{children}</p>

      {[...weekendVsWeekdayDiff.entries()].map(([currency, data]) => (
        <div key={`weekend-weekday-${currency}`}>
          <strong>{currency}:</strong>{' '}
            On weekends you spent an average of <span className="LogsSummary__highlight">{data.weekendAvg.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>, compared to weekdays where you averaged <span className="LogsSummary__highlight">{data.weekdayAvg.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          {data.difference > 0 ? (
            <span> (You spend <span className="LogsSummary__highlight">{data.difference.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span> more on weekends)</span>
          ) : data.difference < 0 ? (
            <span> (You spend <span className="LogsSummary__highlight">{Math.abs(data.difference).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span> more on weekdays)</span>
          ) : (
            <span> (You spend about the same regardless!)</span>
          )}
        </div>
      ))}
    </div>
  )
}

const LowSpenderAlert = ({ groupAnalytics, children }: { groupAnalytics?: GroupAnalytics, children: ReactNode }) => {
  const { dailyAverages } = useSpendingData()

  if (!groupAnalytics) {
    return null // Can't determine low spender status without group data
  }

  const lowSpenderCurrencies = [...dailyAverages.entries()]
    .filter(([currency, userAvg]) => {
      const percentiles = groupAnalytics.currencyPercentiles.get(currency)
      return percentiles && userAvg <= percentiles.p25
    })
    .map(([currency]) => currency)

  if (lowSpenderCurrencies.length === 0) {
    return null
  }

  return (
    <div className="LogsSummary__bubble LogsSummary__bubble--alert">
      <p>{children}</p>
      <p>
        You're amongst the <span className="LogsSummary__highlight">lowest spenders</span> in: <span className="LogsSummary__highlight">{lowSpenderCurrencies.join(', ')}</span>
      </p>
    </div>
  )
}

const NoSpendDaysText = ({ children }: { children: ReactNode }) => {
  const { noSpendDays, totalDaysInPeriod } = useSpendingData()

  const noSpendPercentage = ((noSpendDays / totalDaysInPeriod) * 100).toFixed(1)

  return (
    <div className="LogsSummary__bubble">
      <p>
        {children}{' '}
        <span className="LogsSummary__highlight">
          {noSpendDays} out of {totalDaysInPeriod} days ({noSpendPercentage}%)
        </span>
        {noSpendDays === 0 && <span> ... 😅</span>}
        {noSpendDays > 0 && (
          <span>
            {noSpendDays === 1 ? ' - great self-control!' : ' - excellent spending discipline!'}
          </span>
        )}
      </p>
    </div>
  )
}

// Attach sub-components to main component
SpendingInsights.NoSpendDaysText = NoSpendDaysText
SpendingInsights.TotalText = TotalText
SpendingInsights.WeekText = WeekText
SpendingInsights.DayText = DayText
SpendingInsights.AveragesText = AveragesText
SpendingInsights.WeekendWeekdayText = WeekendWeekdayText
SpendingInsights.LowSpenderAlert = LowSpenderAlert

export default SpendingInsights