import { useMemo } from "react"
import dayjs from "dayjs"
import MDEditor from "@uiw/react-md-editor"

import { useCurrentUser } from "@/contexts"
import { Currency, Group, LogPost } from "@/types/user"

interface LogsSummaryProps {
  group: Group
  logPosts: Array<LogPost>
}

const LogsSummary = ({ group, logPosts }: LogsSummaryProps) => {
  const { user: loggedInUser } = useCurrentUser()
  const myLogs = useMemo(() => {
    return logPosts.filter(logPost => logPost.author.id === loggedInUser?.id)
  }, [logPosts])

  const { myTotalSpent, myExpensiveWeek, myExpensiveDay } = useMemo(() => {
    let myTotalSpent = new Map<Currency, number>()
    let weeklyTotals = new Map<string, { currencyMap: Map<Currency, number>, date: dayjs.Dayjs }>()
    let dailyTotals = new Map<string, { currencyMap: Map<Currency, number>, date: dayjs.Dayjs, posts: LogPost[] }>()

    myLogs.forEach(log => {
      const currency = log.currency
      const postDate = dayjs(log.postDate.seconds * 1000) // Convert Firebase Timestamp
      const logPost = log

      // Calculate total spent
      let prevTotal = myTotalSpent.get(currency) || 0
      myTotalSpent.set(currency, prevTotal + log.amount)

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
    let myExpensiveWeek = new Map<Currency, { week: string, amount: number }>()
    for (const [weekKey, weekData] of weeklyTotals) {
      const weekStart = weekData.date
      const weekEnd = weekStart.add(6, 'day')
      const weekRange = `${weekStart.format('ddd D MMM YYYY')} to ${weekEnd.format('ddd D MMM YYYY')}`

      for (const [currency, amount] of weekData.currencyMap) {
        const current = myExpensiveWeek.get(currency)
        if (!current || amount > current.amount) {
          myExpensiveWeek.set(currency, { week: weekRange, amount })
        }
      }
    }

    // Find most expensive day per currency
    let myExpensiveDay = new Map<Currency, { day: string, amount: number, posts: LogPost[] }>()
    for (const [dayKey, dayData] of dailyTotals) {
      const dayFormatted = dayData.date.format('ddd D MMM YYYY')

      for (const [currency, amount] of dayData.currencyMap) {
        const current = myExpensiveDay.get(currency)
        if (!current || amount > current.amount) {
          myExpensiveDay.set(currency, { day: dayFormatted, amount, posts: dayData.posts })
        }
      }
    }

    return { myTotalSpent, myExpensiveWeek, myExpensiveDay }
  }, [myLogs])

  return (
    <>
      <div className="LogsSummary">
        <h2>
          Insights for {group.title}
        </h2>
        <div className="Window">
          <h3>{loggedInUser?.displayName}'s spending</h3>

          <div className="LogsSummary__bubble">
            <p>
              <span>You spent a <strong>total of</strong> </span>
              <span className="LogsSummary__highlight">
                {[...myTotalSpent.entries()]
                  .filter(([currency, value]) => value > 0)
                  .map(([currency, value]) => `${value} ${currency}`)
                  .join(', ')
                }
              </span>
              <span> in total over the period of {dayjs(group.start.seconds * 1000).format('ddd D MM YYYY')} to {dayjs(group.end.seconds * 1000).format('ddd D MM YYYY')}</span>
            </p>
          </div>

          <div className="LogsSummary__bubble">
            <p>
              <span>You <strong>spent the most</strong> during the <strong>weeks of</strong> </span>
              <span className="LogsSummary__highlight">
                {[...myExpensiveWeek.entries()]
                  .filter(([currency, value]) => value.amount > 0)
                  .map(([currency, value]) => `${value.week} (${value.amount} ${currency})`)
                  .join(', ')
                }
              </span>
            </p>
          </div>

          <div className="LogsSummary__bubble">
            <p>
              <span>The <strong>day you spent the most</strong> was </span>
              <span className="LogsSummary__highlight">
                {[...myExpensiveDay.entries()]
                  .filter(([currency, value]) => value.amount > 0)
                  .map(([currency, value]) => `${value.day} (${value.amount} ${currency})`)
                  .join(', ')
                }
              </span>
            </p>

            <p>
              <span>Remember what you were doing that day? Maybe these will jog your memory...</span>
            </p>

            <div className="LogsSummary__ScrollList">
              {(() => {
                // Find the single most expensive day across all currencies
                const expensiveEntries = [...myExpensiveDay.entries()]
                  .filter(([currency, value]) => value.amount > 0)

                if (expensiveEntries.length === 0) return null

                const mostExpensiveEntry = expensiveEntries.reduce((max, current) =>
                  current[1].amount > max[1].amount ? current : max
                )

                return mostExpensiveEntry[1].posts.map(post =>
                  <div key={`PreviewPost__${post.id}`} className="PostPreview" data-color-mode="light">
                    <MDEditor.Markdown source={post.content} />
                  </div>
                )
              })()}
            </div>
          </div>

        </div>
      </div>
      <div className="LogsSummaryRight">

      </div>
    </>
  )
}

export default LogsSummary