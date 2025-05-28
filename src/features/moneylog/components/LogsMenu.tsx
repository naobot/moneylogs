import { Dispatch, SetStateAction } from "react"
import { UserData } from "../../../hooks/useGetUserInfo"

type LogsMenuProps = {
  logMembers: Array<UserData>
  setter: Dispatch<SetStateAction<UserData | undefined>>
}

const LogsMenu = ({ logMembers, setter }: LogsMenuProps) => {
  return (
    <>
      <div className="LogsMenu">
        {logMembers?.map((member) => {
          return (
            <div className="LogsMenu__item" key={member.id} onClick={() => setter(member)}>
              {member?.displayName}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default LogsMenu