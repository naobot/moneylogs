import { useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
// @ts-ignore
import { db } from '@/config/firebase-config'

import { useCurrentUser } from "@/utils/auth"
import { parseReferenceArray } from "@/utils/helpers"

import LogsMenu from "@/features/moneylog/components/LogsMenu"
import { ActiveLog } from "@/features/moneylog/components/ActiveLog"
import { useGetMultipleUsers, UserData } from "@/hooks/useGetUserInfo"
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery"
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

  const isProcessingJoin = useMemo(() => {
    return addGroupToMember.isLoading || addMemberToGroup.isLoading
  }, [addGroupToMember, addMemberToGroup])

  const [displayUser, setDisplayUser] = useState<UserData>(loggedInUser)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const [isCreateNewEntry, isCreateNewEntrySet] = useState(false)

  const memberIds = useMemo(() => {
    if (!group?.members) return []
    return parseReferenceArray(group.members).map(ref => ref.id)
  }, [group?.id, group?.members])

  const { users: members, isLoading: isLoadingMembers } = useGetMultipleUsers(memberIds)

  const isActiveLogMyLog = useMemo(() => {
    return loggedInUser?.id === displayUser?.id
  }, [loggedInUser, displayUser])
  const currentUserIsMember = useMemo(() => {
    return memberIds.includes(loggedInUser?.id)
  }, [loggedInUser, memberIds])

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

      refetch()
    } catch (error) {
      console.error('Failed to join group:', error)
    }
  }

  const formatDate = (secondsDate: number, formatString: string) => {
    return dayjs(secondsDate * 1000)?.format(formatString)
  }

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
      if (!loggedInUser?.userId || !groupId || !displayUser?.userId || !memberIds.includes(displayUser?.id) ) return

      // Don't track when viewing own logs
      if (loggedInUser.userId === displayUser.userId) return

      try {
        await updateViewTrackingFn({
          userId: loggedInUser.userId,
          logGroupId: groupId,
          viewedUserId: displayUser.userId
        })
      } catch (error) {
        console.error('Failed to update view tracking:', error)
      }
    }

    updateViewTracking()
  }, [displayUser?.userId, loggedInUser?.userId, groupId, memberIds])

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
          {!isLoadingMembers && groupId && displayUser && (<>
            <LogsMenu
              logMembers={members}
              displayUser={displayUser}
              onChangeUser={handleUserChange}
              groupId={groupId}
            />
            <ActiveLog group={group} groupId={groupId} userId={displayUser?.userId} isCreateNewEntry={isCreateNewEntry} isCreateNewEntrySet={isCreateNewEntrySet} isMyLog={isActiveLogMyLog} />
          </>)}
        </div>
      </div>
      {!currentUserIsMember &&
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