import { Dispatch, useEffect } from "react"

import { Group, LogPost } from "@/types/user"
import { UserData } from "@/hooks/useGetUserInfo"

import LogPosts from "./LogPosts/LogPosts"

type ActiveLogProps = {
  displayUser: UserData
  logPosts: Array<LogPost>
  group: Group
  groupId: string
  userId: string
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isMyLog: boolean
}

export const ActiveLog = ({ displayUser, logPosts, group, groupId, userId, isCreateNewEntry, isCreateNewEntrySet, isMyLog = false }: ActiveLogProps) => {

  useEffect(() => {
    isCreateNewEntrySet(false)
  }, [userId, groupId])

  return (
    <>
      <LogPosts
        groupId={groupId}
        user={displayUser}
        userId={userId}
        isMyLog={isMyLog}
        logs={logPosts}
        isCreateNewEntry={isCreateNewEntry}
        isCreateNewEntrySet={isCreateNewEntrySet}
      />
    </>
  )
}