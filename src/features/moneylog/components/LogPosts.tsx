import cx from "classnames"
import { Dispatch, useMemo, useState } from "react"
import { LogPost } from "../../../types/user"
import Button from "../../../components/Button"
import dayjs from "dayjs"

type LogPostsProps = {
  isMyLog: boolean
  logs: LogPost[]
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
}

type DateBanner = {
  type: 'week' | 'day'
  text: string
  _isBanner: boolean
}

const LogPosts = ({ isMyLog, logs, isCreateNewEntry = false, isCreateNewEntrySet }: LogPostsProps) => {
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
        <div className={cx("LogPosts__posts", {
          "LogPosts__posts--weekly": isWeeklyView,
        })}>
          {false && calendarMarkedPosts?.length > 0 && <>
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
          </>}

          {isCreateNewEntry && (
            <div className="LogPosts__posts__item">
              <div
                className="LogPosts__posts__item__header"
              >
                <div
                  className="LogPosts__posts__item__date"
                >
                  date
                </div>
                <div className="LogPosts__posts__item__amount">
                  amount
                </div>
                <div
                  className="LogPosts__posts__item__comments"
                >
                </div>
              </div>
              <div
                className="LogPosts__posts__item__body"
              >
                <div className="LogPosts__posts__item__content">
                  content
                </div>
              </div>
            </div>
          )}

          {calendarMarkedPosts?.length > 0 && calendarMarkedPosts?.map((item: LogPost | DateBanner, i) => {
            if ('_isBanner' in item && item._isBanner) {
              return (
              <div
                className={cx("LogPosts__posts__banner", {
                  "LogPosts__posts__banner--weekly-view": isWeeklyView,
                  "LogPosts__posts__banner--week": item.type == 'week',
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
                  <div
                    className="LogPosts__posts__item__header"
                  >
                    <div
                      className="LogPosts__posts__item__date"
                    >
                      {date?.format("HH:mm")}
                    </div>
                    <div className="LogPosts__posts__item__amount">
                      {(item as LogPost).amount} {(item as LogPost).currency}
                    </div>
                    <div
                      className="LogPosts__posts__item__comments"
                    >
                      ({(item as LogPost)?.replies?.length ?? 0})
                    </div>
                  </div>
                  <div
                    className="LogPosts__posts__item__body"
                  >
                    <div className="LogPosts__posts__item__content">
                      <p>{(item as LogPost).content}</p>
                    </div>
                  </div>
                </div>
              )
            }
          })}
          {calendarMarkedPosts?.length == 0 && <div>No log entries to display!</div>}
        </div>
        <div className="LogPosts__comments">
          !
        </div>
      </div>
    </>
  )
}

export default LogPosts