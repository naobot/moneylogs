import { useMemo } from "react"
import { useGetCurrentGroups } from "../../hooks/useGetCurrentGroups"
import { useCurrentUser } from "../../utils/auth"
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

  // useEffect(() => {
  //   // console.log(currentGroups)
  //   if (isSuccess) {
  //     console.log(currentGroups)
  //   }
  // }, [currentGroups])

  return (
    <>
      {isLoading && <div className="InfoBox">...</div>}
      {latestActiveGroup &&
        <Group groupId={latestActiveGroup?.id} />
      }
    </>
  )
}