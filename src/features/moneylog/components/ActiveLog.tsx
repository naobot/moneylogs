import { Link } from "react-router-dom"
import LogPosts from "./LogPosts"
import { useGetGroup } from "../../../hooks/useGetGroup"
import { useGetLogPosts } from "../../../hooks/useGetLogPosts"

type ActiveLogProps = {
  groupId: string
  userId: string
}

export const ActiveLog = ({ groupId, userId }: ActiveLogProps) => {
  const { group, isLoading, isSuccess, isError, error } = useGetGroup(groupId)
  const logPostRes = useGetLogPosts({ groupId, userId })

  // useEffect(() => {
  //   console.log(logPostRes)
  // }, [logPostRes])

  return (
    <>
      {(isLoading || logPostRes?.isLoading) && <div>...</div>}
      {(isSuccess && logPostRes?.isSuccess) && (
        <>
          <div className="GroupLogDashboard">
            <h2>
              <Link to={`/g/${group?.id}`}>{group?.title}</Link>
            </h2>
            <LogPosts logs={logPostRes?.data} />
          </div>
        </>
      )}
      {isError && error && <div>{error?.message}</div>}
    </>
  )
}