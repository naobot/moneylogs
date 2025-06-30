import cx from 'classnames'
import { Dispatch, Fragment, useEffect, useMemo, useState } from "react"

import { useCurrentUser } from "@/contexts"
import { LogPost } from "@/types/user"

import { useReadTracking } from "@/hooks/useReadTracking"
import { useUserQuery } from "@/hooks/useUserQuery"
import { useDisableScroll } from "@/hooks/useDisableScroll"
import { useGetComments } from "@/hooks/useGetLogPostComments"
import LogPostEditor from './LogPostEditor'
import { LogPostItem } from './LogPosts'
import LogPostComments from './LogPostComments'
import dayjs from 'dayjs'
import { FullUserData, useGetGroupUsers } from '@/hooks/useGetGroupUsers'

const AllLogsDigest = ({ groupId, logs, isCreateNewEntrySet, isReadOnly = false }: {
  groupId: string
  logs: LogPost[]
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isReadOnly: boolean
}) => {
  const { markCommentsAsViewedFn } = useUserQuery()
  const { user: loggedInUser } = useCurrentUser()
  const { trackUserAction } = useReadTracking()
  const { users: members } = useGetGroupUsers(groupId)

  const memberMap = useMemo(() => {
    const result = new Map<string, FullUserData>

    members.forEach(member => result.set(member.id, member))

    return result
  }, [members])

  const visibleLogs = useMemo(() => {
    return logs.filter(log => {
      const authorsPinnedPost = memberMap.get(log.author.id)?.pinnedPosts?.[groupId]?.pinnedPost
      return authorsPinnedPost !== log.id
    })
  }, [logs, memberMap, groupId])

  const [selectedPost, setSelectedPost] = useState<LogPost | null>(null)
  const [currentlyEditingPostId, setCurrentlyEditingPostId] = useState<string | null>(null)
  const [shouldForceFresh, setShouldForceFresh] = useState(false)

  useDisableScroll(!!selectedPost)

  // Single instance of the comment hook
  const {
    data: comments,
    isLoading: isLoadingComments,
    isSuccess: isSuccessComments,
    refreshComments
  } = useGetComments({
    logPostId: selectedPost?.id ?? null,
    forceFresh: shouldForceFresh,
  })

  const handleOpenComments = (post: LogPost, hasUnreadComments: boolean) => {
    // Always set shouldForceFresh based on whether we're opening a different post
    // or if the same post has unread comments
    const isNewPost = selectedPost?.id !== post.id
    const shouldRefresh = isNewPost || hasUnreadComments

    console.log(`👆 opening comments for post ${post.id} (new: ${isNewPost}, unread: ${hasUnreadComments}, refresh: ${shouldRefresh})`)

    setShouldForceFresh(shouldRefresh)
    setSelectedPost(post)
  }

  useEffect(() => {
    setSelectedPost(null)
    setShouldForceFresh(false)
  }, [])

  useEffect(() => {
    if (!selectedPost) {
      setShouldForceFresh(false)
    }
  }, [selectedPost])

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
      <div className="LogPosts">
        <div className={cx("LogPosts__posts", {
          "disable-scroll": selectedPost,
        })}>
          {visibleLogs.length > 0 && (
            <div
              className={cx("LogPosts__posts__banner LogPosts__posts__item__header LogPosts__posts__banner--week")}
            >
              <div className="LogPosts__posts__banner__left"></div>
              <div className="LogPosts__posts__banner__center">
                Posts from {dayjs(logs?.[visibleLogs.length-1]?.postDate?.seconds * 1000).format('ddd D MMM YYYY')}
              </div>
              <div></div>
            </div>
          )}
          {visibleLogs?.map((item: LogPost, i) => {
            const isMyPost = item.author.id == loggedInUser?.id
            const authorData = memberMap.get(item.author.id)

            if (currentlyEditingPostId === (item as LogPost).id) {
              return <LogPostEditor
                key={(item as LogPost).id}
                type={'edit'}
                postId={(item as LogPost).id}
                groupId={groupId}
                userId={loggedInUser?.userId}
                isCreateNewEntrySet={isCreateNewEntrySet}
                setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                content={(item as LogPost).content}
                amount={(item as LogPost).amount}
                currency={(item as LogPost).currency}
                date={(item as LogPost).postDate?.seconds * 1000}
                timezone={(item as LogPost).timezone ?? undefined}
              />
            }

            return (
              <Fragment key={(item as LogPost).id}>
                <LogPostItem
                  user={isMyPost ? loggedInUser : authorData}
                  groupId={groupId}
                  post={(item as LogPost)}
                  isDigestMode={true}
                  isMyLog={isMyPost}
                  selectedPostId={selectedPost?.id ?? null}
                  setSelectedPost={setSelectedPost}
                  setCurrentlyEditingPostId={setCurrentlyEditingPostId}
                  onOpenComments={handleOpenComments}
                />
                {i == logs?.length - 1 && (
                  <div className={cx("LogPosts__posts__filler", {
                    "LogPosts__posts__filler--active" : selectedPost?.id
                  })}></div>
                )}
              </Fragment>
            )
          })
        }
        {visibleLogs?.length == 0 && <div className="LogPosts__error">No log entries to display!</div>}
        </div>
      </div>
      <div className="LogPostComments">
        {selectedPost && (
          <LogPostComments
            currentLogAuthorId={selectedPost.author?.id}
            postId={selectedPost.id}
            comments={comments}
            isLoadingComments={isLoadingComments}
            isSuccessComments={isSuccessComments}
            refreshComments={refreshComments}
          />
        )}
      </div>
      {selectedPost && <div className="LogPostComments__handler handler" onClick={() => setSelectedPost(null)}></div>}
    </>
  )
}

export default AllLogsDigest