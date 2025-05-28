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

export const GroupPage = () => {
  const { groupId } = useParams()
  const { group, isLoading: isLoadingGroup, isSuccess, isError, error } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
  const [displayUser, setDisplayUser] = useState<UserData>()

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
      console.log('ur not a member of this log group!')
    }
  }, [currentUserIsMember])

  return (
    <div className="Group">
      {(isLoadingGroup || isLoadingMembers) && <>...</>}
      {!isLoadingMembers && <LogsMenu logMembers={members} setter={setDisplayUser} />}
      {groupId &&
        <ActiveLog groupId={groupId} userId={displayUser?.userId} />
      }
    </div>
  )
}