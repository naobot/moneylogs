import { Dispatch, SetStateAction, useEffect } from "react"
import { UserData } from "../../../hooks/useGetUserInfo"
import cx from 'classnames'

type LogsMenuProps = {
  displayUser: UserData
  logMembers: Array<UserData>
  setter: Dispatch<SetStateAction<UserData | undefined>>
}

const LogsMenu = ({ displayUser, logMembers, setter }: LogsMenuProps) => {
  return (
    <>
      <div className="LogsMenu">
        {logMembers?.map((member) => {
          return (
            <div
              className={cx("LogsMenu__item", {
                'LogsMenu__item--active' : displayUser?.id === member?.id
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