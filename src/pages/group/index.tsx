import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

import { useCurrentUser } from "../../utils/auth"
import { parseReferenceArray } from "../../utils/helpers"
import { useLogGroupQuery } from "../../hooks/useLogGroupQuery"
import { useGetGroup } from "../../hooks/useGetGroup"

import Modal from "../../components/Modal"

// @ts-ignore
import { db } from '../../config/firebase-config'
import { Group } from "../../features/moneylog/components/Group"

export const GroupPage = () => {
  const { groupId } = useParams()
  const { group, isLoading: isLoadingGroup, isSuccess: isSuccessGroup, refetch } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
  const { addGroupToMember, addMemberToGroup } = useLogGroupQuery()
  const isProcessingJoin = useMemo(() => {
    return addGroupToMember.isLoading || addMemberToGroup.isLoading
  }, [addGroupToMember, addMemberToGroup])

  const [showInviteModal, setShowInviteModal] = useState(false)

  const memberIds = useMemo(() => {
    if (!group?.members) return []
    return parseReferenceArray(group.members).map(ref => ref.id)
  }, [group?.members])

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
    if (isSuccessGroup && !currentUserIsMember) {
      setShowInviteModal(true)
    }
  }, [currentUserIsMember, isSuccessGroup])

  return (
    <>
      {groupId && <Group groupId={groupId} />}
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