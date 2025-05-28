import { useParams } from "react-router-dom"
import { ActiveLog } from "../../features/moneylog/components/ActiveLog"

export const GroupPage = () => {
  const { groupId } = useParams()

  return (
    <div className="Group">
      {groupId &&
        <ActiveLog groupId={groupId} />
      }
    </div>
  )
}