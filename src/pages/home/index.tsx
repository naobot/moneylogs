import { useEffect, useMemo } from "react"
import { useGetCurrentGroups } from "../../hooks/useGetCurrentGroups"
import { ActiveLog } from "../../features/moneylog/components/ActiveLog"
import { useCurrentUser } from "../../utils/auth"

export const Home = () => {
  const { user } = useCurrentUser()
  const { currentGroups, isSuccess, isLoading, isError } = useGetCurrentGroups()
  const latestActiveGroup = useMemo(() => {
    if (currentGroups?.length > 0) {
      return currentGroups[0]
    }
    else {
      return null
    }
  }, [currentGroups])

  // useEffect(() => {
  //   // console.log(currentGroups)
  //   if (isSuccess) {
  //     console.log(currentGroups)
  //   }
  // }, [currentGroups])

  return (
    <>
      {isLoading && <div className="InfoBox">...</div>}
      {/*<div className="InfoBox">
        <Button
          text='Start new log group'
          to='/create'
        />
      </div>*/}
      {/*<div className="InfoBox">
      {isSuccess && currentGroups.length>0 && currentGroups.map((group) => (
          <div key={group.id}>
            {group.title}
          </div>
        ))}
      </div>*/}
      {isSuccess && latestActiveGroup && (
        <div className="Group">
          {user &&
            <ActiveLog groupId={latestActiveGroup?.id} userId={user?.userId} />
          }
        </div>
      )}
    </>
  )
}