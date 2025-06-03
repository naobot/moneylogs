import cx from "classnames"
import { ChangeEvent, Dispatch, useEffect, useMemo, useState } from "react"
import { Currency, LogPost } from "../../../types/user"
import Button from "../../../components/Button"
import dayjs from "dayjs"
import MDEditor from "@uiw/react-md-editor"
import { LogData, useLogPostQuery } from "../../../hooks/useLogPostQuery"
import { useMutation } from "../../../hooks/useFirebase"
import Icon, { IconText } from "../../../components/Icon"

type LogPostsProps = {
  groupId: string
  userId: string
  logs: LogPost[]
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isMyLog: boolean
}

type DateBanner = {
  type: 'week' | 'day'
  text: string
  _isBanner: boolean
}

const CURRENCIES: Array<Currency> = [
  'JPY',
  'USD',
  'CAD',
  'KRW',
  'CNY',
  'EUR',
  'GBP',
  'NTD',
  'AUD',
  'MYR',
]

const LogPosts = ({ groupId, userId, logs, isCreateNewEntry = false, isCreateNewEntrySet, isMyLog = false }: LogPostsProps) => {
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

  const [newEntryContent, newEntryContentSet] = useState<string|null>()
  const [newEntryAmount, newEntryAmountSet] = useState<number>(0)
  const [newEntryDate, newEntryDateSet] = useState<number>(Date.now())
  const [selectedCurrency, selectedCurrencySet] = useState<Currency>()

  const { addNewLogPost } = useLogPostQuery()
  const { mutate: createLogPost, isLoading: createPending, isError, error } = useMutation(
    async (logData: LogData) => {
      return await addNewLogPost.mutate({
        groupId,
        userId,
        logData,
      })
    }
  )

  useEffect(() => {
    const lastCurrency = (localStorage.getItem('ML__lastCurrency') as Currency)
    if (lastCurrency && CURRENCIES.includes(lastCurrency)) {
      selectedCurrencySet(lastCurrency as Currency)
    }
  }, [])

  const handleSelectCurrency = (e: ChangeEvent<HTMLSelectElement>) => {
    localStorage.setItem('ML__lastCurrency', e.target.value)
    selectedCurrencySet(e.target.value as Currency)
  }

  const handleNewLogPost = async () => {
    if (!selectedCurrency || !newEntryContent) return

    try {
      await createLogPost(
        {
          amount: newEntryAmount,
          currency: selectedCurrency,
          content: newEntryContent,
          postDate: newEntryDate,
        }
      )

      isCreateNewEntrySet(false)
      newEntryContentSet(null)
      newEntryAmountSet(0)
    } catch (err) {
      console.error('Failed to create log post:', err)
    }
  }

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

          {/*{isMyLog && (
            <div className="LogPosts__menu">
              <div
                className="handler"
                onClick={() => {
                  isCreateNewEntrySet(true)
                }}
              >
                <Icon type={'document'} />
              </div>
            </div>
          )}*/}

          {isCreateNewEntry && (
            <div className="LogPosts__posts__item">
              <div
                className="LogPosts__posts__item__header"
              >
                <div
                  className="LogPosts__posts__item__header__left"
                >
                  <input
                    type="datetime-local"
                    id="meeting-time"
                    name="meeting-time"
                    value={dayjs(newEntryDate).format('YYYY-MM-DDTHH:mm')}
                    onChange={(e) => newEntryDateSet(dayjs(e?.target?.value, 'YYYY-MM-DDTHH:mm').unix() * 1000)}
                  />
                </div>
                <div className="LogPosts__posts__item__header__center LogPosts__posts__item__amount">
                  <input
                    type="number"
                    onChange={(e) => newEntryAmountSet(e?.target?.value)}
                    value={newEntryAmount}
                  />
                  <select
                    name="currency"
                    id="newEntry-currency"
                    onChange={handleSelectCurrency}
                    value={selectedCurrency}
                  >
                    {CURRENCIES.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div
                  className="LogPosts__posts__item__header__right LogPosts__posts__item__comments"
                >
                  <Button
                    buttonStyle="primary-border-lite"
                    size="sm"
                    text={'×'}
                    aria-label="Close"
                    title="Close"
                    onClick={() => isCreateNewEntrySet(false)}
                  />
                </div>
              </div>
              <div
                className="LogPosts__posts__item__body"
              >
                <div className="LogPosts__posts__item__content container" data-color-mode="light">
                  <div className="LogPosts__posts__item__content__editor">
                    <MDEditor
                      value={newEntryContent ?? ''}
                      onChange={newEntryContentSet}
                      preview='edit'
                    />
                    <MDEditor.Markdown source={newEntryContent} style={{ whiteSpace: 'pre-wrap' }} />
                  </div>
                </div>
              </div>
              <div className="LogPosts__posts__item__footer">
                <Button
                  buttonStyle="primary-border"
                  size="sm"
                  text="Submit"
                  disabled={!newEntryContent || createPending}
                  onClick={handleNewLogPost}
                />
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
              const postTime = dayjs((item as LogPost).postDate?.seconds * 1000)
              const createdTime = dayjs((item as LogPost).createdAt?.seconds * 1000)
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
                      className="LogPosts__posts__item__header__left LogPosts__posts__item__date"
                      title={`Posted on ${createdTime?.format("ddd D MMM YYYY HH:mm")}`}
                    >
                      <IconText type='clock' text={postTime?.format("HH:mm")} />
                    </div>
                    <div className="LogPosts__posts__item__header__center LogPosts__posts__item__amount">
                      {(item as LogPost).amount} {(item as LogPost).currency}
                    </div>
                    <div
                      className="LogPosts__posts__item__header__right LogPosts__posts__item__comments"
                    >
                      <IconText type='speech' text={(item as LogPost)?.replies?.length ?? 0} size={18} />
                    </div>
                  </div>
                  <div
                    className="LogPosts__posts__item__body"
                  >
                    <div className="LogPosts__posts__item__content" data-color-mode="light">
                      <MDEditor.Markdown source={(item as LogPost).content} style={{ whiteSpace: 'pre-wrap' }} />
                    </div>
                  </div>
                </div>
              )
            }
          })}
          {calendarMarkedPosts?.length == 0 && <div className="LogPosts__error">No log entries to display!</div>}
        </div>
        <div className="LogPosts__comments">
          comments
        </div>
      </div>
    </>
  )
}

export default LogPosts