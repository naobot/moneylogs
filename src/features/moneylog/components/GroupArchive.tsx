import { Link } from "react-router-dom";
import { Fragment } from "react/jsx-runtime";

import { Group } from "@/types/user";
import dayjs from "dayjs";

type GroupArchiveProps = {
  groups: Array<Group>;
  emptyMessage?: string;
};

const GroupArchive = ({ groups, emptyMessage }: GroupArchiveProps) => {
  if (groups.length === 0) {
    return emptyMessage ? <p className="GroupArchive__empty">{emptyMessage}</p> : null;
  }

  return (
    <Fragment>
      <ul>
        {groups.map((group) => (
          <li key={group.id}>
            <Link to={`/g/${group.id}`}>{group.title}</Link>{" "}
            <small>
              ({dayjs(group.start.toDate()).format("ddd D MMM YYYY")} to{" "}
              {dayjs(group.end.toDate()).format("ddd D MMM YYYY")})
            </small>
          </li>
        ))}
      </ul>
    </Fragment>
  );
};

export default GroupArchive;
