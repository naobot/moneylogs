import { useMemo, createContext, useContext, ReactNode } from "react"
import dayjs from "dayjs"
import MDEditor from "@uiw/react-md-editor"

import { Currency, Group, LogPost } from "@/types/user"
import Icon from "@/components/Icon"

interface SpendingData {
  totalSpent: Map<Currency, number>
  expensiveWeek: Map<Currency, { week: string, amount: number }>
  expensiveDay: Map<Currency, { day: string, amount: number, posts: LogPost[] }>
  group: Group
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
  children: ReactNode
}

const SpendingInsights = ({ logPosts, group, children }: SpendingInsightsProps) => {
  const spendingData = useMemo(() => {
    let totalSpent = new Map<Currency, number>()
    let weeklyTotals = new Map<string, { currencyMap: Map<Currency, number>, date: dayjs.Dayjs }>()
    let dailyTotals = new Map<string, { currencyMap: Map<Currency, number>, date: dayjs.Dayjs, posts: LogPost[] }>()

    logPosts.forEach(log => {
      const currency = log.currency
      const postDate = dayjs(log.postDate.seconds * 1000) // Convert Firebase Timestamp
      const logPost = log

      // Calculate total spent
      let prevTotal = totalSpent.get(currency) || 0
      totalSpent.set(currency, prevTotal + log.amount)

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
      weekData.currencyMap.set(currency, (weekData.currencyMap.get(currency) || 0) + log.amount)

      // Track daily totals
      if (!dailyTotals.has(dayKey)) {
        dailyTotals.set(dayKey, {
          currencyMap: new Map<Currency, number>(),
          date: postDate,
          posts: [],
        })
      }
      const dayData = dailyTotals.get(dayKey)!
      dayData.currencyMap.set(currency, (dayData.currencyMap.get(currency) || 0) + log.amount)
      dayData.posts = [...dayData.posts, logPost]
    })

    // Find most expensive week per currency
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

    // Find most expensive day per currency
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

    return { totalSpent, expensiveWeek, expensiveDay, group }
  }, [logPosts, group])

  return (
    <SpendingContext.Provider value={spendingData}>
      {children}
    </SpendingContext.Provider>
  )
}

const TotalText = ({ children }: { children: ReactNode }) => {
  const { totalSpent, group } = useSpendingData()

  return (
    <div className="LogsSummary__bubble">
      <p>
        {children}{' '}
        <span className="LogsSummary__highlight">
          {[...totalSpent.entries()]
            .filter(([currency, value]) => value > 0)
            .map(([currency, value]) => `${value} ${currency}`)
            .join(', ')
          }
        </span>
        <span> in total over the period of {dayjs(group.start.seconds * 1000).format('ddd D MM YYYY')} to {dayjs(group.end.seconds * 1000).format('ddd D MM YYYY')}</span>
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
              <span className="LogsSummary__highlight">{expensiveWeeks.map(([currency, value]) => `${value.week} (${value.amount} ${currency})`)}</span>
            </p>
          )
        } else {
          return (
            <>
              <p>{children}...</p>
              <ul className="LogsSummary__List">{expensiveWeeks.map(([currency, value]) => <li key={`w-${currency}__${value.amount}`}>{`${value.week} (${value.amount} ${currency})`}</li>)}</ul>
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

              return (showMultipleDays ? someExpensivePosts : mostExpensiveEntry[1].posts).map(post =>
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

// Attach sub-components to main component
SpendingInsights.TotalText = TotalText
SpendingInsights.WeekText = WeekText
SpendingInsights.DayText = DayText

export default SpendingInsights