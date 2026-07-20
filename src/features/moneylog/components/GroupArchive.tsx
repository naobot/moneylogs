import { Link } from "react-router-dom";
import { Fragment } from "react/jsx-runtime";

import { Group } from "@/types/user";
import { byMostRecentlyEnded } from "@/utils/groupBoundaries";
import dayjs from "dayjs";

type GroupArchiveProps = {
  groups: Array<Group>;
  emptyMessage?: string;
  // The source query has no orderBy, so sort here rather than trusting the caller.
  sort?: (a: Group, b: Group) => number;
};

const GroupArchive = ({ groups, emptyMessage, sort = byMostRecentlyEnded }: GroupArchiveProps) => {
  if (groups.length === 0) {
    return emptyMessage ? <p className="GroupArchive__empty">{emptyMessage}</p> : null;
  }

  // Copy before sorting — `groups` is a prop and Array.sort mutates in place.
  const ordered = [...groups].sort(sort);

  return (
    <Fragment>
      <ul>
        {ordered.map((group) => (
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
