import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

import { useCurrentUser } from "../../utils/auth"
import { parseReferenceArray } from "../../utils/helpers"

import LogsMenu from "../../features/moneylog/components/LogsMenu"
import { ActiveLog } from "../../features/moneylog/components/ActiveLog"
import { useGetMultipleUsers, UserData } from "../../hooks/useGetUserInfo"
import { useLogGroupQuery } from "../../hooks/useLogGroupQuery"
import { useGetGroup } from "../../hooks/useGetGroup"

import Modal from "../../components/Modal"

// @ts-ignore
import { db } from '../../config/firebase-config'

export const GroupPage = () => {
  const { groupId } = useParams()
  const { group, isLoading: isLoadingGroup, isSuccess: isSuccessGroup, refetch } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
  const { addGroupToMember, addMemberToGroup } = useLogGroupQuery()
  const isProcessingJoin = useMemo(() => {
    return addGroupToMember.isLoading || addMemberToGroup.isLoading
  }, [addGroupToMember, addMemberToGroup])

  const [displayUser, setDisplayUser] = useState<UserData>()
  const [showInviteModal, setShowInviteModal] = useState(false)

  const memberIds = useMemo(() => {
    if (!group?.members) return []
    return parseReferenceArray(group.members).map(ref => ref.id)
  }, [group?.members])

  const { users: members, isLoading: isLoadingMembers } = useGetMultipleUsers(memberIds)

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

      await refetch()
    } catch (error) {
      console.error('Failed to join group:', error)
    }
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

  return (
    <>
      <div className="Group">
        {(isLoadingGroup || isLoadingMembers) && <>...</>}
        {!isLoadingMembers && <LogsMenu logMembers={members} setter={setDisplayUser} />}
        {groupId &&
          <ActiveLog groupId={groupId} userId={displayUser?.userId} />
        }
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