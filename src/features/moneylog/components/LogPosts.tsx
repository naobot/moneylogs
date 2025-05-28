import cx from "classnames"
import { useMemo, useState } from "react"
import { LogPost } from "../../../types/user"
import Button from "../../../components/Button"
import dayjs from "dayjs"

type LogPostsProps = {
  logs: LogPost[]
}

type DateBanner = {
  type: 'week' | 'day'
  text: string
  _isBanner: boolean
}

const LogPosts = ({ logs }: LogPostsProps) => {
  const [isWeeklyView, isWeeklyViewSet] = useState(false)
  const calendarMarkedPosts = useMemo(() => {
    const displayRows: Array<LogPost | DateBanner> = []
    const now = dayjs()
    let currentWeekStart: dayjs.Dayjs | null = null
    let currentDay: number | null = null

    logs?.forEach((post) => {
      const logPostDate = dayjs(post?.postDate?.seconds * 1000)
      const postWeekStart = logPostDate.startOf('week') // Gets Monday of that week

      // Check if we've moved to a new week
      if (!currentWeekStart || !postWeekStart.isSame(currentWeekStart)) {
        currentWeekStart = postWeekStart
        currentDay = null // Reset day tracking for new week

        // Calculate weeks ago
        const weeksAgo = now.startOf('week').diff(postWeekStart, 'week')
        const weekText = weeksAgo === 0 ? 'This week' :
                        weeksAgo === 1 ? '1 week ago' :
                        `${weeksAgo} weeks ago`

        displayRows.push({
          text: weekText,
          type: 'week',
          _isBanner: true
        })
      }

      // Check if we've moved to a new day within the week
      if (logPostDate.day() !== currentDay) {
        currentDay = logPostDate.day()
        displayRows.push({
          text: logPostDate.format('ddd D MMM YYYY'),
          type: 'day',
          _isBanner: true
        })
      }

      displayRows.push(post)
    })

    return displayRows
  }, [logs?.length])

  return (
    <>
      <div className={cx("LogPosts", {
        "LogPosts--weekly": isWeeklyView,
      })}>
        <div className="LogPosts__menu">
          <Button
            className={"LogPosts__menu__button"}
            text="Daily"
            onClick={() => isWeeklyViewSet(false)}
            isSelected={!isWeeklyView}
            size="md"
            buttonStyle="primary-border"
          />
          <Button
            className={"LogPosts__menu__button"}
            text="Weekly"
            onClick={() => isWeeklyViewSet(true)}
            isSelected={isWeeklyView}
            size="md"
            buttonStyle="primary-border"
          />
        </div>
        <div className={cx("LogPosts__posts", {
          "LogPosts__posts--weekly": isWeeklyView,
        })}>
          {calendarMarkedPosts?.map((item: LogPost | DateBanner, i) => {
            if ('_isBanner' in item && item._isBanner) {
              return (
              <div
                className={cx("LogPosts__posts__item", {
                  "LogPosts__posts__item--weekly": isWeeklyView,
                  "LogPosts__posts__item--banner": true,
                })}
                key={`banner-${i}`}
              >
                {item?.text}
              </div>
              )
            }
            else {
              const date = dayjs((item as LogPost).postDate?.seconds * 1000)
              return (
                <div
                  className={cx("LogPosts__posts__item", {
                    "LogPosts__posts__item--weekly": isWeeklyView,
                  })}
                  key={(item as LogPost).id}
                >
                  <div>
                    {date?.format("HH:mm")}
                  </div>
                  <p>{(item as LogPost).content}</p>
                </div>
              )
            }
          })}
        </div>
      </div>
    </>
  )
}

export default LogPosts