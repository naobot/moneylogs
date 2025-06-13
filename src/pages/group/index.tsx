import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { useCurrentUser } from "@/contexts"

import { parseReferenceArray } from "@/utils/helpers"
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery"
import { useGetGroup } from "@/hooks/useGetGroup"
import { Group } from "@/features/moneylog/components/Group"

import Modal from "@/components/Modal"
import Button from "@/components/Button"

// @ts-ignore
import { db } from '@/config/firebase-config'

export const GroupPage = () => {
  const navigate = useNavigate()
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

      navigate('/')
    } catch (error) {
      console.error('Failed to join group:', error)
    }
  }

  useEffect(() => {
    if (isSuccessGroup && group && group.members && !currentUserIsMember) {
      setShowInviteModal(true)
    }
  }, [currentUserIsMember, isSuccessGroup])

  return (
    <>
      {isSuccessGroup && group && groupId && <Group group={group} groupId={groupId} />}
      {isSuccessGroup && group && groupId && !currentUserIsMember && (
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
        </Modal>
      )}
    </>
  )
}