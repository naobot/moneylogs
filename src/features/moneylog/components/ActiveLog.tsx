import { Dispatch, useEffect } from "react"
import LogPosts from "./LogPosts"
import { useGetGroup } from "../../../hooks/useGetGroup"
import { useGetLogPosts } from "../../../hooks/useGetLogPosts"
import { useCurrentUser } from "../../../utils/auth"

type ActiveLogProps = {
  groupId: string
  userId: string
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isMyLog: boolean
}

export const ActiveLog = ({ groupId, userId, isCreateNewEntry, isCreateNewEntrySet, isMyLog = false }: ActiveLogProps) => {
  const { group, isLoading, isSuccess, isError, error } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
  const logPostRes = useGetLogPosts({ groupId, userId })

  useEffect(() => {
    isCreateNewEntrySet(false)
  }, [userId, groupId])

  return (
    <div className="GroupLogDashboard">
      {/*{(isLoading || logPostRes?.isLoading) && <div>...</div>}*/}
      {(isSuccess && logPostRes?.isSuccess) && (
        <>
          <LogPosts
            groupId={groupId}
            userId={userId}
            isMyLog={isMyLog}
            logs={logPostRes?.data}
            isCreateNewEntry={isCreateNewEntry}
            isCreateNewEntrySet={isCreateNewEntrySet}
          />
        </>
      )}
      {isError && error && <div>{error?.message}</div>}
    </div>
  )
}