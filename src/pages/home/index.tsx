import { useMemo } from "react"
import { Link } from "react-router-dom"

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups"
import { Group } from "@/features/moneylog/components/Group"

import { Timestamp } from "firebase/firestore"
import GroupArchive from "@/features/moneylog/components/GroupArchive"

export const Home = () => {
  const { currentGroups, allGroups, isSuccess, isLoading, isError } = useGetCurrentGroups()

  const latestActiveGroup = useMemo(() => {
    if (currentGroups?.length > 0 && currentGroups[0].end.toDate() >= Timestamp.now().toDate()) {
      console.log(currentGroups[0].end.toDate())
      console.log(Timestamp.now().toDate())

      return currentGroups[0]
    }
    else {
      return null
    }
  }, [currentGroups])

  return (
    <>
      {isLoading && <div className="InfoBox">...</div>}
      {!isLoading && isSuccess && latestActiveGroup &&
        <Group group={latestActiveGroup} groupId={latestActiveGroup?.id} />
      }
      {!isLoading && isSuccess && !latestActiveGroup && (
        <div className="Content__body">
          <h3>You are not currently part of any ongoing log groups</h3>
          <p>
            If you know someone participating in one, please wait for their invitation link.
          </p>
          <p>
            You can also <Link to="/create">create one</Link> yourself.
          </p>

          {allGroups.length > 0 && (
            <div>
              <h3>Past groups</h3>
              <GroupArchive groups={allGroups} />
            </div>
          )}
        </div>
      )}
    </>
  )
}