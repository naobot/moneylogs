import { useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
// @ts-ignore
import { db } from '@/config/firebase-config'

import { useCurrentUser } from "@/contexts"

import LogsMenu from "@/features/moneylog/components/LogsMenu"
import { ActiveLog } from "@/features/moneylog/components/ActiveLog"
import { useGetGroupUsers } from "@/hooks/useGetGroupUsers"
import { UserData } from "@/hooks/useGetUserInfo"
import { useReadTracking } from "@/hooks/useReadTracking"
import { useGetLogPosts } from "@/hooks/useGetLogPosts"
import { useUserQuery } from "@/hooks/useUserQuery"

import { IconText } from "@/components/Icon"
import { Timestamp } from "firebase/firestore"
import LogsSummary from "./LogsSummary/LogsSummary"

export const Group = ({ group, groupId }) => {
  const { user: loggedInUser } = useCurrentUser()
  const { updateViewTrackingFn } = useUserQuery()
  const { trackUserAction } = useReadTracking()

  const logPostRes = useGetLogPosts({ groupId })

  const [displayAll, setDisplayAll] = useState(false)
  const [displayUser, setDisplayUser] = useState<UserData|null>(loggedInUser)
  const [displaySummary, setDisplaySummary] = useState(false)

  const [isCreateNewEntry, isCreateNewEntrySet] = useState(false)

  const { users: members, isLoading: isLoadingMembers, userIdToDocRefMap } = useGetGroupUsers(groupId)

  const isReadOnly = useMemo(() => {
    return group.end.toDate() < Timestamp.now().toDate()
  }, [group])

  const memberIds = useMemo(() => {
    if (!members) return []
    return members.map(ref => ref.id)
  }, [groupId, members])

  const isActiveLogMyLog = useMemo(() => {
    return loggedInUser?.id === displayUser?.id
  }, [loggedInUser, displayUser])

  const formatDate = (secondsDate: number, formatString: string) => {
    return dayjs(secondsDate * 1000)?.format(formatString)
  }

  useEffect(() => {
    // Only initialize if displayUser is not already set
    if (loggedInUser) {
      setDisplayUser(loggedInUser)
    }
  }, [loggedInUser?.id, groupId])

  useEffect(() => {
    isCreateNewEntrySet(false)
  }, [group])

  useEffect(() => {
    trackUserAction('view_group', {
      user_id: loggedInUser?.id,
      group_id: groupId,
    })
  }, [groupId, trackUserAction])

  useEffect(() => {
    const updateViewTracking = async () => {
      // Only track if we have all required data and user is viewing someone else's logs
      if (!userIdToDocRefMap || userIdToDocRefMap.size === 0) return
      if (!loggedInUser?.userId || !groupId || !displayUser?.userId || !memberIds.includes(displayUser?.id)) return

      const viewingUserDocRefId = userIdToDocRefMap.get(loggedInUser.userId)
      const viewedUserDocRefId = userIdToDocRefMap.get(displayUser.userId)

      if (!viewingUserDocRefId || !viewedUserDocRefId) {
        console.error('User not found in map', { viewingUserDocRefId, viewedUserDocRefId })
        return
      }

      try {
        await updateViewTrackingFn({
          userId: viewingUserDocRefId,
          logGroupId: groupId,
          viewedUserId: viewedUserDocRefId,
        })

        trackUserAction('update_user_last_viewed', {
          user_id: loggedInUser?.id,
          group_id: groupId,
        })
      } catch (error) {
        console.error('Failed to update view tracking:', error)
      }
    }

    updateViewTracking()
  }, [displayUser?.userId, loggedInUser?.userId, groupId])

  const handleUserChange = (newUser: any) => {
    if (newUser) {
      setDisplayUser(newUser)
      setDisplayAll(false)
      setDisplaySummary(false)
    } else {
      setDisplayAll(true)
    }

    setTimeout(() => {
      const logPostsContainer = document.querySelector('.LogPosts__posts')

      if (logPostsContainer) {
        logPostsContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
      }
    }, 100)
  }

  const handleViewSummary = () => {
    setDisplayUser(null)
    setDisplayAll(false)
    setDisplaySummary(true)

    setTimeout(() => {
      const logPostsContainer = document.querySelector('.LogPosts__posts')

      if (logPostsContainer) {
        logPostsContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
      }
    }, 100)
  }

  return (
    <>
      <div className="Group">
        <div className="Group__header">
          <div className="Group__header__left">
            <div className="GroupInterval Group__header__item">
              {group &&
                <>{formatDate(group.start?.seconds, 'D MMM')} to {formatDate(group.end?.seconds, 'D MMM')}</>
              }
            </div>
          </div>

          <div className="Group__header__center">
            {!isReadOnly && isActiveLogMyLog && (
              <div
                className="handler Group__header__item"
                onClick={() => {
                  isCreateNewEntrySet(true)
                }}
              >
                <IconText type={'document'} fill={'white'} text="new entry" />
              </div>
            )}
          </div>

          <div className="Group__header__right">
          </div>
        </div>
        <div className="Group__body">
          {/*{(isLoadingGroup || isLoadingMembers) && <>...</>}*/}
          {logPostRes.isSuccess && !isLoadingMembers && groupId && (<>
            <LogsMenu
              logMembers={members}
              logPosts={logPostRes.posts}
              displayAll={displayAll}
              displaySummary={displaySummary}
              displayUser={displayUser}
              onChangeUser={handleUserChange}
              onViewSummary={handleViewSummary}
              groupId={groupId}
              isReadOnly={isReadOnly}
            />
            {displaySummary && (<LogsSummary group={group} logPosts={logPostRes.posts} />)}
            {!displaySummary && displayUser && (
              <ActiveLog
                group={group}
                groupId={groupId}
                logPosts={displayAll ? logPostRes.posts : logPostRes.posts.filter((post) => post.author.id == displayUser.id)}
                displayAll={displayAll}
                displayUser={displayUser}
                userId={displayUser?.userId}
                isCreateNewEntry={isCreateNewEntry}
                isCreateNewEntrySet={isCreateNewEntrySet}
                isMyLog={isActiveLogMyLog}
                isReadOnly={isReadOnly}
              />
            )}
          </>)}
        </div>
      </div>
    </>
  )
}