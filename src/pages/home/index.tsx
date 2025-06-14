import { useMemo } from "react"
import { useGetCurrentGroups } from "../../hooks/useGetCurrentGroups"
import { Group } from "../../features/moneylog/components/Group"
import { Link } from "react-router-dom"

export const Home = () => {
  const { currentGroups, isSuccess, isLoading, isError } = useGetCurrentGroups()
  const latestActiveGroup = useMemo(() => {
    if (currentGroups?.length > 0) {
      return currentGroups[0]
    }
    else {
      return null
    }
  }, [currentGroups])

  return (
    <>
      {isLoading && <div className="InfoBox">...</div>}
      {latestActiveGroup &&
        <Group group={latestActiveGroup} groupId={latestActiveGroup?.id} />
      }
      {!latestActiveGroup && (
        <div>
          <h3>You are not currently part of any log groups</h3>
          <p>
            If you know someone participating in one, please wait for their invitation link.
          </p>
          <p>
            You can also <Link to="/create">create one</Link> yourself.
          </p>
        </div>
      )}
    </>
  )
}