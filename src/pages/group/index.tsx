import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

import { useCurrentUser } from "../../utils/auth"
import { parseReferenceArray } from "../../utils/helpers"

import LogsMenu from "../../features/moneylog/components/LogsMenu"
import { ActiveLog } from "../../features/moneylog/components/ActiveLog"
import { useGetMultipleUsers, UserData } from "../../hooks/useGetUserInfo"
import { useGetGroup } from "../../hooks/useGetGroup"

// @ts-ignore
import { db } from '../../config/firebase-config'
import Modal from "../../components/Modal"

export const GroupPage = () => {
  const { groupId } = useParams()
  const { group, isLoading: isLoadingGroup, isSuccess, isError, error } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
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

  useEffect(() => {
    // Initialize with loggedInUser
    setDisplayUser(loggedInUser)
  }, [loggedInUser])

  useEffect(() => {
    if (!currentUserIsMember) {
      setShowInviteModal(true)
    }
  }, [currentUserIsMember])

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
        title="Information"
        okButtonText="Join"
        showOkButton
        showCloseButton
        onClose={() => setShowInviteModal(false)}
      >
        <p>
          ur not a member!
        </p>
      </Modal>}
    </>
  )
}