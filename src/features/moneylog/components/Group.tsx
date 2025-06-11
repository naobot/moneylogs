import { useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
// @ts-ignore
import { db } from '@/config/firebase-config'

import { useCurrentUser } from "@/contexts"

import LogsMenu from "@/features/moneylog/components/LogsMenu"
import { ActiveLog } from "@/features/moneylog/components/ActiveLog"
import { useGetGroupUsers } from "@/hooks/useGetGroupUsers"
import { UserData } from "@/hooks/useGetUserInfo"
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery"
import { useGetLogPosts } from "@/hooks/useGetLogPosts"
// import { useGetGroup } from "@/hooks/useGetGroup"
import { useUserQuery } from "@/hooks/useUserQuery"

import Modal from "@/components/Modal"
import { IconText } from "@/components/Icon"
import Button from "@/components/Button"

export const Group = ({ group, groupId }) => {
  // const { group, isLoading: isLoadingGroup, isSuccess: isSuccessGroup, refetch } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
  const { addGroupToMember, addMemberToGroup } = useLogGroupQuery()
  const { updateViewTrackingFn } = useUserQuery()

  const logPostRes = useGetLogPosts({ groupId })

  const isProcessingJoin = useMemo(() => {
    return addGroupToMember.isLoading || addMemberToGroup.isLoading
  }, [addGroupToMember, addMemberToGroup])

  const [displayUser, setDisplayUser] = useState<UserData>(loggedInUser)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const [isCreateNewEntry, isCreateNewEntrySet] = useState(false)

  // const { users: members, isLoading: isLoadingMembers } = useGetMultipleUsers(memberIds)
  const { users: members, isLoading: isLoadingMembers, userIdToDocRefMap } = useGetGroupUsers(groupId)

  const memberIds = useMemo(() => {
    if (!members) return []
    return members.map(ref => ref.id)
  }, [groupId, members])

  const isActiveLogMyLog = useMemo(() => {
    return loggedInUser?.id === displayUser?.id
  }, [loggedInUser, displayUser])
  const currentUserIsMember = useMemo(() => {
    if (loggedInUser?.id && groupId) {
      return memberIds.includes(loggedInUser?.id)
    }
    return false
  }, [loggedInUser, memberIds, groupId])

  const handleJoinGroup = async () => {
    console.log('Attempting to join!')
    try {
      await Promise.all([
        addGroupToMember.mutate({
          currentUserId: loggedInUser.userId,
          groupId,
        }),
        addMemberToGroup.mutate({
          currentUserId: loggedInUser.userId,
          groupId,
        }),
      ])
    } catch (error) {
      console.error('Failed to join group:', error)
    }
  }

  const formatDate = (secondsDate: number, formatString: string) => {
    return dayjs(secondsDate * 1000)?.format(formatString)
  }

  // const userIdToDocRefMap = useMemo(() => {
  //   const map = new Map<string, string>();
  //   members.forEach(user => {
  //     map.set(user.userId, user.id) // or however you access the doc ref ID
  //   })
  //   return map
  // }, [members])

  useEffect(() => {
    // Only initialize if displayUser is not already set
    if (loggedInUser && !displayUser) {
      setDisplayUser(loggedInUser)
    }
  }, [loggedInUser, displayUser, groupId])

  useEffect(() => {
    if (!currentUserIsMember) {
      setShowInviteModal(true)
    }
  }, [currentUserIsMember])

  useEffect(() => {
    isCreateNewEntrySet(false)
    setDisplayUser(loggedInUser)
  }, [group])

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
      } catch (error) {
        console.error('Failed to update view tracking:', error)
      }
    }

    updateViewTracking()
  }, [displayUser?.userId, loggedInUser?.userId, groupId])

  const handleUserChange = (newUser: any) => {
    setDisplayUser(newUser)

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
            {isActiveLogMyLog && (
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
          {logPostRes.isSuccess && !isLoadingMembers && groupId && displayUser && (<>
            <LogsMenu
              logMembers={members}
              logPosts={logPostRes.posts}
              displayUser={displayUser}
              onChangeUser={handleUserChange}
              groupId={groupId}
            />
            <ActiveLog
              group={group}
              groupId={groupId}
              logPosts={logPostRes.posts.filter((post) => post.author.id == displayUser.id)}
              displayUser={displayUser}
              userId={displayUser?.userId}
              isCreateNewEntry={isCreateNewEntry}
              isCreateNewEntrySet={isCreateNewEntrySet}
              isMyLog={isActiveLogMyLog}
            />
          </>)}
        </div>
      </div>
      {isLoadingMembers && !currentUserIsMember &&
      <Modal
        isOpen={showInviteModal}
      >
        <Modal.Header></Modal.Header>
        <Modal.Body>
          <p>
            You've been invited to join this moneylog!
          </p>
        </Modal.Body>
        <Modal.Actions>
          <Button
            onClick={handleJoinGroup}
            buttonStyle="primary-border"
            text="Join"
            disabled={isProcessingJoin}
          />
        </Modal.Actions>
      </Modal>}
    </>
  )
}