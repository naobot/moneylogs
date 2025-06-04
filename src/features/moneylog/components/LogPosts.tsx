import cx from "classnames"
import { ChangeEvent, Dispatch, useEffect, useMemo, useState } from "react"
import { Currency, LogPost } from "../../../types/user"
import Button from "../../../components/Button"
import dayjs from "dayjs"
import MDEditor from "@uiw/react-md-editor"
import { useLogPostQuery } from "../../../hooks/useLogPostQuery"
import Icon, { IconText } from "../../../components/Icon"
import { useGetComments } from "../../../hooks/useGetLogPostComments"
import { useCurrentUser } from "../../../utils/auth"

type LogPostsProps = {
  groupId: string
  userId: string
  logs: LogPost[]
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isMyLog: boolean
}

type LogPostCommentsProps = {
  postId: string
}

type DateBanner = {
  type: 'week' | 'day'
  text: string
  total: { [key: string]: number }
  runningTotal: { [key: string]: number }
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

const LogPostComments = ({ postId }: LogPostCommentsProps) => {
  const { data: comments, isLoading: isLoadingComments, isSuccess: isSuccessComments } = useGetComments({ logPostId: postId })
  const [newCommentContent, newCommentContentSet] = useState<string|null>()
  const { user } = useCurrentUser()

  const { addComment, deleteComment } = useLogPostQuery()

  const handleAddComment = async () => {
    if (!newCommentContent?.trim()) return

    try {
      await addComment.mutate({
        logPostId: postId,
        userId: user?.userId,
        content: newCommentContent,
      })
      newCommentContentSet('')
    } catch (err) {
      console.error('Failed to add comment:', err)
    }
  }

  return (
    <div className="LogPostComments__wrapper">
      {isLoadingComments && <>...</>}
      {!isLoadingComments && isSuccessComments && comments?.length === 0 && (
        <div className="LogPostComments__notice">No comments</div>
      )}
      {!isLoadingComments && isSuccessComments && comments?.map(comment => {
        return (
          <div key={comment.id} className="LogPostComments__item">
            <div className="LogPostComments__item__container">
              <div className="LogPostComments__item__body" data-color-mode="light">
                <MDEditor.Markdown source={comment.content} />
              </div>
              <div className="LogPostComments__item__footer">
                <div className="LogPostComments__item__footer__right">
                  - {comment.authorName}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <div className="LogPostComments__item">
        <div className="LogPostComments__item__container">
          <div className="LogPostComments__item__body container" data-color-mode="light">
            {!addComment?.isLoading && (
              <MDEditor
                value={newCommentContent ?? ''}
                onChange={newCommentContentSet}
                preview='edit'
                hideToolbar
                height={120}
              />
            )}
            {addComment?.isLoading && <>...</>}
          </div>
        </div>
        <div className="LogPostComments__item__footer">
          <Button
            size="xs"
            buttonStyle="primary-border-lite"
            text="Comment"
            onClick={handleAddComment}
            disabled={!newCommentContent || addComment?.isLoading}
          />
        </div>
      </div>
    </div>
  )
}

const LogPosts = ({ groupId, userId, logs, isCreateNewEntry = false, isCreateNewEntrySet, isMyLog = false }: LogPostsProps) => {
  const [isWeeklyView, isWeeklyViewSet] = useState(false)

  const calendarMarkedPosts = useMemo(() => {
    const displayRows: Array<LogPost | DateBanner> = []
    const now = dayjs()
    let currentWeekStart: dayjs.Dayjs | null = null
    let currentDay: number | null = null
    let runningTotals: { [key: string]: number } = {}
    let weeklyTotals: { [key: string]: number } = {}
    let dailyTotals: { [key: string]: number } = {}

    logs?.forEach((post) => {
      const logPostDate = dayjs(post?.postDate?.seconds * 1000)
      const postWeekStart = logPostDate.startOf('week') // Gets Monday of that week

      if (!(post.currency in runningTotals)) {
        runningTotals[post.currency] = 0
      }
      runningTotals[post.currency] += Number(post.amount)

      // Check if we've moved to a new week
      if (!currentWeekStart || !postWeekStart.isSame(currentWeekStart)) {
        currentWeekStart = postWeekStart
        currentDay = null // Reset day tracking for new week
        weeklyTotals = {} // Reset current weekly totals

        // Calculate weeks ago
        const weeksAgo = now.startOf('week').diff(postWeekStart, 'week')
        const weekText = weeksAgo === 0 ? 'This week' :
                        weeksAgo === 1 ? '1 week ago' :
                        weeksAgo < 0 ? 'Upcoming' :
                        `${weeksAgo} weeks ago`

        displayRows.push({
          text: weekText,
          type: 'week',
          _isBanner: true,
          runningTotal: runningTotals,
          total: weeklyTotals,
        })
      }

      // Accumulate weekly totals
      if (!(post.currency in weeklyTotals)) {
        weeklyTotals[post.currency] = 0
      }
      weeklyTotals[post.currency] += Number(post.amount)

      // Check if we've moved to a new day within the week
      if (logPostDate.day() !== currentDay) {
        currentDay = logPostDate.day()
        dailyTotals = {}

        displayRows.push({
          text: logPostDate.format('ddd D MMM YYYY'),
          type: 'day',
          _isBanner: true,
          runningTotal: runningTotals,
          total: dailyTotals,
        })
      }

      // Accumulate daily totals
      if (!(post.currency in dailyTotals)) {
        dailyTotals[post.currency] = 0
      }
      dailyTotals[post.currency] += Number(post.amount)

      displayRows.push(post)
    })

    return displayRows
  }, [logs])

  const [newEntryContent, newEntryContentSet] = useState<string|null>()
  const [newEntryAmount, newEntryAmountSet] = useState<number>(0)
  const [newEntryDate, newEntryDateSet] = useState<number>(Date.now())
  const [selectedCurrency, selectedCurrencySet] = useState<Currency>('JPY')

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)

  const { addNewLogPost, deleteLogPost } = useLogPostQuery()

  const handleNewLogPost = async () => {
    if (!selectedCurrency || !newEntryContent) {
      return
    }

    try {
      await addNewLogPost.mutate({
        groupId,
        userId,
        logData: {
          amount: newEntryAmount,
          currency: selectedCurrency,
          content: newEntryContent,
          postDate: newEntryDate,
        }
      })

      isCreateNewEntrySet(false)
      newEntryContentSet(null)
      newEntryAmountSet(0)
    } catch (err) {
      console.error('Failed to create log post:', err)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!postId) {
      return
    }

    try {
      await deleteLogPost.mutate({
        logPostId: postId,
      })

      if (selectedPostId === postId) {
        setSelectedPostId(null)
      }
    } catch (err) {
      console.error('Failed to delete log post:', err)
    }
  }

  const handleEditPost = async (postId: string) => {
    if (!postId) {
      return
    }

    // try {
    //   await deleteLogPost.mutate({
    //     logPostId: postId,
    //   })

    //   if (selectedPostId === postId) {
    //     setSelectedPostId(null)
    //   }
    // } catch (err) {
    //   console.error('Failed to delete log post:', err)
    // }
  }

  useEffect(() => {
    const lastCurrency = (localStorage.getItem('ML__lastCurrency') as Currency)
    if (lastCurrency && CURRENCIES.includes(lastCurrency)) {
      selectedCurrencySet(lastCurrency as Currency)
    }

    isCreateNewEntrySet(false)
  }, [])

  useEffect(() => {
    setSelectedPostId(null)
  }, [userId])

  const handleSelectCurrency = (e: ChangeEvent<HTMLSelectElement>) => {
    localStorage.setItem('ML__lastCurrency', e.target.value)
    selectedCurrencySet(e.target.value as Currency)
  }

  const handleCommentsClick = (postId: string) => {
    setSelectedPostId(postId)
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
                    className="LogPostsCurrency__input"
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
                    <MDEditor.Markdown source={newEntryContent ?? ''} />
                  </div>
                </div>
              </div>
              <div className="LogPosts__posts__item__footer">
                <Button
                  buttonStyle="primary-border"
                  size="sm"
                  text="Submit"
                  disabled={!selectedCurrency || !newEntryContent || addNewLogPost?.isLoading}
                  onClick={handleNewLogPost}
                />
              </div>
            </div>
          )}

          {calendarMarkedPosts?.length > 0 && calendarMarkedPosts?.map((item: LogPost | DateBanner, i) => {
            if ('_isBanner' in item && item._isBanner) {
              const currencyKeys = Object.keys(item?.total)
              const formattedTotals = currencyKeys.map(x => `${item?.total[x]?.toLocaleString()} ${x}`)

              return (
              <div
                className={cx("LogPosts__posts__banner LogPosts__posts__item__header", {
                  "LogPosts__posts__banner--weekly-view": isWeeklyView,
                  "LogPosts__posts__banner--week": item.type == 'week',
                })}
                key={`banner-${i}`}
              >
                <div className="LogPosts__posts__banner__left">{item?.text}</div>
                <div className="LogPosts__posts__banner__center">
                  {formattedTotals?.map(x => <span key={`${i}-${x}`}>{x}</span>)}
                </div>
                <div></div>
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
                    "LogPosts__posts__item--selected": selectedPostId===(item as LogPost).id
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
                      <IconText
                        type='speech'
                        text={((item as LogPost)?.commentCount ?? 0).toLocaleString()}
                        size={18}
                        className="handler"
                        onClick={() => handleCommentsClick((item as LogPost).id)}
                      />
                    </div>
                  </div>
                  <div
                    className="LogPosts__posts__item__body"
                  >
                    <div className="LogPosts__posts__item__content" data-color-mode="light">
                      <MDEditor.Markdown source={(item as LogPost).content} />
                    </div>
                  </div>
                  {isMyLog && (
                    <>
                      <div className="LogPosts__posts__item__footer">
                        <div></div>
                        <div className="LogPosts__posts__item__footer__center LogPostMenu">
                          <IconText
                            className="handler LogPostMenu__item"
                            type='pencil'
                            size={18}
                            onClick={() => handleEditPost((item as LogPost).id)}
                          />
                          <IconText
                            className="handler LogPostMenu__item"
                            type='trash'
                            onClick={() => handleDeletePost((item as LogPost).id)}
                          />
                        </div>
                        <div className="LogPosts__posts__item__footer__right">
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            }
          })}
          {calendarMarkedPosts?.length == 0 && <div className="LogPosts__error">No log entries to display!</div>}
        </div>

        <div className="LogPostComments">
          {selectedPostId && <LogPostComments postId={selectedPostId} />}
        </div>
      </div>
    </>
  )
}

export default LogPosts
