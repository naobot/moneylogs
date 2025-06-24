import { Link } from "react-router-dom"
import { Fragment } from "react/jsx-runtime"

import { Group } from "@/types/user"

type GroupArchiveProps = {
  groups: Array<Group>
}

const GroupArchive = ({ groups }: GroupArchiveProps) => {
  return (
    <Fragment>
      <ul>
        {groups.map(group => (
          <li key={group.id}>
            <Link to={`/g/${group.id}`}>{group.title}</Link>
          </li>
        ))}
      </ul>
    </Fragment>
  )
}

export default GroupArchive