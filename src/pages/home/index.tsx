import { useMemo } from "react"
import { useGetCurrentGroups } from "../../hooks/useGetCurrentGroups"
import { Group } from "../../features/moneylog/components/Group"

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
    </>
  )
}