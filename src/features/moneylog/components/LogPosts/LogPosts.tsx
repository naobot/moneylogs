import cx from "classnames"
import { Dispatch, Fragment, useEffect, useMemo, useRef, useState } from "react"
import dayjs from "dayjs"

import MDEditor from "@uiw/react-md-editor"

import { Currency, LogPost } from "@/types/user"
import { useCurrentUser } from "@/contexts"

import { useLogPostQuery } from "@/hooks/useLogPostQuery"
import { useDisableScroll } from "@/hooks/useDisableScroll"
import { useUserQuery } from "@/hooks/useUserQuery"
import { UserData } from "@/hooks/useGetUserInfo"
import { useReadTracking } from "@/hooks/useReadTracking"

import Modal from "@/components/Modal"
import Button from "@/components/Button"
import Icon, { IconText } from "@/components/Icon"
import LogPostEditor from "./LogPostEditor"
import LogPostComments from "./LogPostComments"
import { allTimezones, useTimezoneSelect } from "react-timezone-select"
import { useExternalLinkHandler } from "@/hooks/useExternalLinkHandler"

type LogPostsProps = {
  user: UserData
  groupId: string
  userId: string
  logs: LogPost[]
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isMyLog: boolean
}

type LogPostProps = {
  user: UserData
  groupId: string
  post: LogPost
  selectedPostId: string | null
  setSelectedPost: Dispatch<React.SetStateAction<LogPost|null>>
  setCurrentlyEditingPostId: Dispatch<React.SetStateAction<string|null>>
  isMyLog: boolean
}

type DateBanner = {
  isFuture: boolean
  type: 'week' | 'day'
  text: string
  total: { [key: string]: number }
  runningTotal: { [key: string]: number }
  _isBanner: boolean
}

export const CURRENCIES: Array<Currency> = [
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

export const useUserTimezone = (date: string | Date | number, userTimezone?: string) => {
  return dayjs(date).tz(userTimezone || dayjs.tz.guess())
}

export const LogPostItem = ({ user, groupId, post, selectedPostId, setSelectedPost, setCurrentlyEditingPostId, isMyLog = false, isDigestMode = false }: LogPostProps) => {
  const postRef = useRef<HTMLDivElement>(null)
  const { user: loggedInUser } = useCurrentUser()
  const [isShowDeleteWarning, setIsShowDeleteWarning] = useState(false)
  const [showPinWarning, setShowPinWarning] = useState(false)

  const { parseTimezone } = useTimezoneSelect({ labelStyle: 'original', timezones: allTimezones })

  const isPinned = useMemo(() => {
    return post.id === user?.pinnedPosts?.[groupId]?.pinnedPost
  }, [user, post])

  const hasUnreadComments = useMemo(() => {
    if (!post.latestCommentAt || !loggedInUser?.userId || !post.commentSubscribers) return false

    // First check: Is the current user subscribed to this post's comments?
    const isSubscribed = post.commentSubscribers.some(subscriber =>
      subscriber.id === loggedInUser.id
    )

    // If not subscribed, no unread indicator
    if (!isSubscribed) return false

    // If subscribed, check if there are unread comments
    const userLastViewed = loggedInUser.commentSubscriptions?.[post.id]?.lastViewedAt

    // If user has never viewed comments on this post, and there are comments, it's unread
    if (!userLastViewed && post.commentCount && post.commentCount > 0) return true

    // If user has viewed before, compare timestamps
    if (userLastViewed) {
      return post.latestCommentAt.seconds > userLastViewed.seconds
    }

    return false
  }, [post.latestCommentAt, post.commentCount, post.id, loggedInUser?.commentSubscriptions])

  useEffect(() => {
    if (postRef.current) {
      postRef.current.focus()
    }
  }, [])

  useExternalLinkHandler(postRef, [post])

  const postTime = useMemo(() => {
    if (post.timezone && !isDigestMode) {
      return useUserTimezone(post.postDate?.seconds * 1000, post.timezone)
    }
    return useUserTimezone(post.postDate?.seconds * 1000, user?.timezone)
  }, [post])
  const createdTime = useMemo(() => {
    return useUserTimezone(post.createdAt?.seconds * 1000, user?.timezone)
  }, [post])

  const { deleteLogPost } = useLogPostQuery()
  const { updatePinnedPost } = useUserQuery()

  const handleDeletePost = async (postId: string) => {
    if (!postId) {
      return
    }

    try {
      await deleteLogPost.mutate({
        logPostId: postId,
      })

      if (selectedPostId === postId) {
        setSelectedPost(null)
      }
    } catch (err) {
      console.error('Failed to delete log post:', err)
    }
  }

  const handlePinPost = async (postId: string) => {
    if (!postId) {
      return
    }

    try {
      await updatePinnedPost.mutate({
        userId: user.id,
        logGroupId: groupId,
        postId: isPinned ? 'none' : postId,
      })

      setShowPinWarning(false)
    } catch (err) {
      console.error('Failed to pin log post:', err)
    }
  }

  useEffect(() => {
    if (selectedPostId === post.id) {
      scrollPostToTop(postRef)
    }
  }, [selectedPostId])

  return (
    <>
      <div
        className={cx("LogPosts__posts__item", {
          "LogPosts__posts__item--selected": selectedPostId===post.id,
          "LogPosts__posts__item--pinned": isPinned && !isDigestMode,
        })}
        ref={postRef}
      >
        {!isPinned && (<>
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
              {(post.amount)?.toLocaleString()} {post.currency}
            </div>
            <div
              className="LogPosts__posts__item__header__right LogPosts__posts__item__comments"
            >
              <IconText
                type={hasUnreadComments ? 'speech-filled' : 'speech'}
                text={(post?.commentCount ?? 0).toLocaleString()}
                size={hasUnreadComments ? 16 : 18}
                className="handler"
                onClick={() => setSelectedPost(post)}
              />
            </div>
          </div>
          {isDigestMode && user && (
            <div
              className="LogPosts__posts__item__header"
            >
              <div
                className="LogPosts__posts__item__header__left"
              >
                <Icon type={"user"} />
                {user.displayName} {user.displayLocation && <>({user.displayLocation})</>}
              </div>
            </div>
          )}
          {!isDigestMode && post.timezone && (post.timezone !== user.timezone) && (
            <div
              className="LogPosts__posts__item__header"
            >
              <div
                className="LogPosts__posts__item__header__left LogPosts__posts__item__date TimezoneSetter"
              >
                {parseTimezone(post.timezone).label}
              </div>
            </div>
          )}
        </>)}
        <div
          className="LogPosts__posts__item__body"
        >
          <div className="LogPosts__posts__item__content" data-color-mode={(isPinned && !isDigestMode) ? "dark" : "light"}>
            <MDEditor.Markdown source={post.content} />
          </div>
        </div>
        {isMyLog && (
          <>
            <div className="LogPosts__posts__item__footer">
              <div className="LogPostMenu">
                {!isDigestMode && (
                  <IconText
                    className={cx("handler LogPostMenu__item", { 'LogPostMenu__item--active': (isPinned && !isDigestMode) })}
                    type='pin'
                    size={16}
                    onClick={(isPinned && !isDigestMode) ? () => handlePinPost(post.id) : () => setShowPinWarning(true)}
                  />
                )}
                <IconText
                  className="handler LogPostMenu__item"
                  type='pencil'
                  size={16}
                  onClick={() => setCurrentlyEditingPostId(post.id)}
                />
                <IconText
                  className="handler LogPostMenu__item"
                  type='trash'
                  onClick={() => setIsShowDeleteWarning(true)}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <Modal
        isOpen={isShowDeleteWarning}
        onClose={() => setIsShowDeleteWarning(false)}
      >
        <Modal.Header
          title={'Warning'}
        >
          Warning
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to <strong>delete</strong> this post?
          </p>
        </Modal.Body>
        <Modal.Actions>
          <Button
            onClick={() => handleDeletePost(post.id)}
            text="Delete"
            buttonStyle="primary-border"
          />
          <Modal.CancelButton text="Nevermind" />
        </Modal.Actions>
      </Modal>
      <Modal
        isOpen={showPinWarning}
        onClose={() => setShowPinWarning(false)}
      >
        <Modal.Header
          title={'Warning'}
        >
          Warning
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to <strong>pin</strong> this post?
          </p>
          <p>
            Your currently pinned post will return to being a regular post.
          </p>
        </Modal.Body>
        <Modal.Actions>
          <Button
            onClick={() => handlePinPost(post.id)}
            text="Pin"
            buttonStyle="primary-border"
          />
          <Modal.CancelButton text="Nevermind" />
        </Modal.Actions>
      </Modal>
    </>
  )
}

const LogPosts = ({ groupId, user, userId, logs, isCreateNewEntry = false, isCreateNewEntrySet, isMyLog = false }: LogPostsProps) => {
  const [isWeeklyView, isWeeklyViewSet] = useState(false)
  const { markCommentsAsViewedFn } = useUserQuery()
  const { user: loggedInUser } = useCurrentUser()
  const { trackUserAction } = useReadTracking()

  const calendarMarkedPosts = useMemo(() => {
    const displayRows: Array<LogPost | DateBanner> = []
    const now = dayjs().tz(user?.timezone || dayjs.tz.guess())
    let currentWeekStart: dayjs.Dayjs | null = null
    let currentDay: number | null = null
    let runningTotals: { [key: string]: number } = {}
    let weeklyTotals: { [key: string]: number } = {}
    let dailyTotals: { [key: string]: number } = {}

    logs?.forEach((post) => {
      const logPostDate = useUserTimezone(post?.postDate?.seconds * 1000, (post?.timezone ?? user?.timezone))
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
          isFuture: weeksAgo < 0,
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
          isFuture: now.diff(logPostDate) < 0,
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

  const [selectedPost, setSelectedPost] = useState<LogPost | null>(null)
  const [currentlyEditingPostId, setCurrentlyEditingPostId] = useState<string | null>(null)
  useDisableScroll(!!selectedPost)

  const postEditorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    isCreateNewEntrySet(false)
  }, [])

  useEffect(() => {
    if (isCreateNewEntry) {
      postEditorRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isCreateNewEntry, postEditorRef])

  useEffect(() => {
    setSelectedPost(null)
  }, [userId])

  useEffect(() => {
    if (loggedInUser && selectedPost?.commentCount && selectedPost.commentCount > 0) {
      trackUserAction('view_post', {
        post_id: selectedPost?.id,
        user_id: loggedInUser?.id,
      })

      markCommentsAsViewedFn({
        userId: loggedInUser.id,
        logPostId: selectedPost.id
      })
    }
  }, [selectedPost?.id, loggedInUser?.userId, trackUserAction])

  return (
    <>
      <div className={cx("LogPosts", {
        "LogPosts--weekly": isWeeklyView,
      })}>
        <div className={cx("LogPosts__posts", {
          "LogPosts__posts--weekly": isWeeklyView,
          "disable-scroll": selectedPost,
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
            <LogPostEditor
              ref={postEditorRef}
              type="new"
              groupId={groupId}
              userId={userId}
              isCreateNewEntrySet={isCreateNewEntrySet}
              setCurrentlyEditingPostId={setCurrentlyEditingPostId}
            />
          )}

          {calendarMarkedPosts?.length > 0 && calendarMarkedPosts?.map((item: LogPost | DateBanner, i) => {
            if ('_isBanner' in item && item._isBanner) {
              const currencyKeys = Object.keys(item?.total)
              const formattedTotals = currencyKeys.map(x => `${item?.total[x]?.toLocaleString()} ${x}`)

              if (item.isFuture) return

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
              if (currentlyEditingPostId === (item as LogPost).id) {
                return <LogPostEditor
                  key={(item as LogPost).id}
                  type={'edit'}
                  postId={(item as LogPost).id}
                  groupId={groupId}
                  userId={userId}
                  isCreateNewEntrySet={isCreateNewEntrySet}
                  setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                  content={(item as LogPost).content}
                  amount={(item as LogPost).amount}
                  currency={(item as LogPost).currency}
                  date={(item as LogPost).postDate?.seconds * 1000}
                  isPinned={currentlyEditingPostId === (isMyLog ? loggedInUser : user)?.pinnedPosts?.[groupId].pinnedPost}
                  timezone={(item as LogPost).timezone ?? undefined}
                />
              }

              return (
                <Fragment key={(item as LogPost).id}>
                  <LogPostItem
                    user={isMyLog ? loggedInUser : user}
                    groupId={groupId}
                    post={(item as LogPost)}
                    isMyLog={isMyLog}
                    selectedPostId={selectedPost?.id ?? null}
                    setSelectedPost={setSelectedPost}
                    setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                  />
                  {i == calendarMarkedPosts?.length - 1 && (
                    <div className={cx("LogPosts__posts__filler", {
                      "LogPosts__posts__filler--active" : selectedPost?.id
                    })}></div>
                  )}
                </Fragment>
              )
            }
          })}
          {calendarMarkedPosts?.length == 0 && <div className="LogPosts__error">No log entries to display!</div>}
        </div>
      </div>
      <div className="LogPostComments">
        {selectedPost && <LogPostComments currentLogAuthorId={logs?.[0]?.author?.id} postId={selectedPost.id} />}
      </div>
      {selectedPost && <div className="LogPostComments__handler handler" onClick={() => setSelectedPost(null)}></div>}
    </>
  )
}

export default LogPosts

export function scrollPostToTop(postRef: React.RefObject<HTMLDivElement>) {
    setTimeout(() => {
        const logPostsContainer = document.querySelector('.LogPosts__posts')
        const postElement = postRef.current

        if (logPostsContainer && postElement) {
            const containerRect = logPostsContainer.getBoundingClientRect()
            const postRect = postElement.getBoundingClientRect()

            const scrollTop = logPostsContainer.scrollTop + (postRect.top - containerRect.top)

            logPostsContainer.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
            })
        }
    }, 100)
}

