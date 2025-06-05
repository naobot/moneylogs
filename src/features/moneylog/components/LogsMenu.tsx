import { Dispatch, SetStateAction } from "react"
import { UserData } from "../../../hooks/useGetUserInfo"
import cx from 'classnames'
import { useCurrentUser } from "../../../utils/auth"

type LogsMenuProps = {
  displayUser: UserData
  logMembers: Array<UserData>
  setter: Dispatch<SetStateAction<UserData | undefined>>
}

const LogsMenu = ({ displayUser, logMembers, setter }: LogsMenuProps) => {
  const { user } = useCurrentUser()

  return (
    <>
      <div className="LogsMenu">
        {logMembers?.map((member) => {
          return (
            <div
              className={cx("LogsMenu__item", {
                'LogsMenu__item--active' : displayUser?.id === member?.id,
                'LogsMenu__item--first' : member?.id === user?.id,
              })}
              key={member.id}
              onClick={() => setter(member)}
            >
              {member?.displayName}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default LogsMenu