import { Dispatch, useEffect } from "react"

import { Group } from "@/types/user"
// import { useGetGroup } from "@/hooks/useGetGroup"
import { useGetLogPosts } from "@/hooks/useGetLogPosts"
import { useCurrentUser } from "@/utils/auth"

import LogPosts from "./LogPosts/LogPosts"

type ActiveLogProps = {
  group: Group
  groupId: string
  userId: string
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isMyLog: boolean
}

export const ActiveLog = ({ group, groupId, userId, isCreateNewEntry, isCreateNewEntrySet, isMyLog = false }: ActiveLogProps) => {
  // const { group, isLoading, isSuccess, isError, error } = useGetGroup(groupId)
  const { user: loggedInUser } = useCurrentUser()
  const logPostRes = useGetLogPosts({ groupId, userId })

  useEffect(() => {
    isCreateNewEntrySet(false)
  }, [userId, groupId])

  return (
    <>
      {(logPostRes?.isSuccess) && (
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
      {logPostRes.isError && <div className="LogPosts">{logPostRes.error?.message}</div>}
    </>
  )
}