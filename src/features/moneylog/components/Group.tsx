import { useEffect, useMemo, useState } from "react"

import { useCurrentUser } from "../../../utils/auth"
import { parseReferenceArray } from "../../../utils/helpers"

import LogsMenu from "../../../features/moneylog/components/LogsMenu"
import { ActiveLog } from "../../../features/moneylog/components/ActiveLog"
import { useGetMultipleUsers, UserData } from "../../../hooks/useGetUserInfo"
import { useLogGroupQuery } from "../../../hooks/useLogGroupQuery"
import { useGetGroup } from "../../../hooks/useGetGroup"

import Modal from "../../../components/Modal"

// @ts-ignore
import { db } from '../../config/firebase-config'
import dayjs from "dayjs"
import { IconText } from "../../../components/Icon"

export const Group = ({ groupId }) => {
  const { group, isLoading: isLoadingGroup, isSuccess: isSuccessGroup, refetch } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
  const { addGroupToMember, addMemberToGroup } = useLogGroupQuery()
  const isProcessingJoin = useMemo(() => {
    return addGroupToMember.isLoading || addMemberToGroup.isLoading
  }, [addGroupToMember, addMemberToGroup])

  const [displayUser, setDisplayUser] = useState<UserData>()
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
    // Initialize with loggedInUser
    setDisplayUser(loggedInUser)
  }, [loggedInUser])

  useEffect(() => {
    if (isSuccessGroup && !currentUserIsMember) {
      setShowInviteModal(true)
    }
  }, [currentUserIsMember, isSuccessGroup])

  useEffect(() => {
    isCreateNewEntrySet(false)
  }, [group])

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
          {!isLoadingGroup && !isLoadingMembers && groupId && (<>
            <LogsMenu logMembers={members} displayUser={displayUser} setter={setDisplayUser} />
            <ActiveLog groupId={groupId} userId={displayUser?.userId} isCreateNewEntry={isCreateNewEntry} isCreateNewEntrySet={isCreateNewEntrySet} isMyLog={isActiveLogMyLog} />
          </>)}
        </div>
      </div>
      {!currentUserIsMember &&
      <Modal
        isOpen={showInviteModal}
        title=""
        okButtonText={"Join"}
        showOkButton
        onOk={handleJoinGroup}
        showCloseButton
        onClose={() => setShowInviteModal(false)}
        disabled={isProcessingJoin}
      >
        <p>
          You've been invited to join this moneylog!
        </p>
      </Modal>}
    </>
  )
}