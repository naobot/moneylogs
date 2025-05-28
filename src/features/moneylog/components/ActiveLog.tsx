import { useEffect, useState } from "react"
import { useGetGroup } from "../../../hooks/useGetGroup"
import { Log, LogPost } from "../../../types/user"
import LogPosts from "./LogPosts"
import LogsMenu from "./LogsMenu"
import { useGetLogPosts } from "../../../hooks/useGetLogPosts"

type ActiveLogProps = {
  groupId: string
  userId: string
}

const currentLogPosts: Array<LogPost> = []

const logs: Array<Log> = [
  {
      id: "log1",
      ownerId: "0MsGl1EORAYSmMgsCm1Q8mDRIAc2",
      createdAt: {
          seconds: 109840913,
          nanoseconds: 1931030,
      },
      posts: currentLogPosts,
  },
  {
      id: "log2",
      ownerId: "8xDGl2eORAaSdMgsCm1v8PlKnMc3",
      createdAt: {
          seconds: 109840913,
          nanoseconds: 1931030,
      },
      posts: currentLogPosts,
  },
]

export const ActiveLog = ({ groupId, userId }: ActiveLogProps) => {
  const { group, isLoading, isSuccess, isError, error } = useGetGroup(groupId)
  const logPostRes = useGetLogPosts({ groupId, userId })
  const [currentLog, currentLogSet] = useState<Log>()

  // useEffect(() => {
  //   console.log(logPostRes)
  // }, [logPostRes])

  return (
    <>
      {(isLoading || logPostRes?.isLoading) && <div>...</div>}
      {(isSuccess && logPostRes?.isSuccess) && (
        <>
          <div className="GroupLogDashboard">
            <h2>{group?.title}</h2>
            <LogPosts logs={logPostRes?.data} />
            {/*{currentLog && <LogStickies log={currentLog} />}*/}
          </div>
        </>
      )}
      {isError && error && <div>{error?.message}</div>}
    </>
  )
}