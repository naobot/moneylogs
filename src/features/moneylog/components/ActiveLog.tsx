import { Dispatch, useEffect, useMemo } from "react"
import dayjs from "dayjs"

import { Group, LogPost } from "@/types/user"
import { UserData } from "@/hooks/useGetUserInfo"

import LogPosts from "./LogPosts/LogPosts"
import AllLogsDigest from "./LogPosts/AllLogsDigest"

type ActiveLogProps = {
  displayAll: boolean
  displayUser: UserData
  logPosts: Array<LogPost>
  group: Group
  groupId: string
  userId: string
  isCreateNewEntry: boolean
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>
  isMyLog: boolean
  isReadOnly: boolean
}

export const ActiveLog = ({ displayAll = false, displayUser, logPosts, group, groupId, userId, isCreateNewEntry, isCreateNewEntrySet, isMyLog = false, isReadOnly = false }: ActiveLogProps) => {
  const recentLogs = useMemo(() => {
    const now = dayjs()
    const twentyFourHoursAgo = dayjs().subtract(24, 'hours')

    return logPosts.filter(post => {
      const postDateTime = dayjs(post.postDate.toDate())
      return postDateTime.isAfter(twentyFourHoursAgo) && postDateTime.isBefore(now)
    })
  }, [logPosts])

  useEffect(() => {
    isCreateNewEntrySet(false)
  }, [userId, groupId])

  return (
    <>
    {!displayAll && displayUser && (
      <LogPosts
        groupId={groupId}
        user={displayUser}
        userId={userId}
        isMyLog={isMyLog}
        logs={logPosts}
        isCreateNewEntry={isCreateNewEntry}
        isCreateNewEntrySet={isCreateNewEntrySet}
        isReadOnly={isReadOnly}
      />
    )}
    {displayAll && (
      <AllLogsDigest
        groupId={groupId}
        logs={recentLogs}
        isCreateNewEntrySet={isCreateNewEntrySet}
        isReadOnly={isReadOnly}
      />
    )}
    </>
  )
}