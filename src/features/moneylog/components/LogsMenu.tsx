import { Dispatch, SetStateAction } from "react"
import { Log } from "../../../types/user"

type LogsMenuProps = {
  logs: Array<Log>
  setCurrentLog: Dispatch<SetStateAction<Log | undefined>>
}

const LogsMenu = ({ logs }: LogsMenuProps) => {
  return (
    <>
      <div className="LogsMenu">
        {logs?.map((log: Log) => {
          return (
            <div className="LogsMenu__item" key={log.id}>
              {log.id}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default LogsMenu