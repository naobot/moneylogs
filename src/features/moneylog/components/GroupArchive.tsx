import { Link } from "react-router-dom";
import { Fragment } from "react/jsx-runtime";

import { Group } from "@/types/user";
import { byMostRecentlyEnded } from "@/utils/groupBoundaries";
import { ManageLogButton } from "@/features/logActions/ManageLogButton";
import { ManageTarget, manageTargetForGroup } from "@/features/logActions/manageTarget";
import dayjs from "dayjs";
import { formatDate } from "@/utils/dateFormat";

type GroupArchiveProps = {
  groups: Array<Group>;
  emptyMessage?: string;
  // The source query has no orderBy, so sort here rather than trusting the caller.
  sort?: (a: Group, b: Group) => number;
  /** When given, each row gets a "manage" button (archive / delete). */
  onManage?: (target: ManageTarget) => void;
};

const GroupArchive = ({
  groups,
  emptyMessage,
  sort = byMostRecentlyEnded,
  onManage,
}: GroupArchiveProps) => {
  if (groups.length === 0) {
    return emptyMessage ? <p className="GroupArchive__empty">{emptyMessage}</p> : null;
  }

  // Copy before sorting — `groups` is a prop and Array.sort mutates in place.
  const ordered = [...groups].sort(sort);

  return (
    <Fragment>
      <ul className={onManage ? "GroupArchive--manageable" : undefined}>
        {ordered.map((group) => (
          <li key={group.id}>
            <span>
              <Link to={`/g/${group.id}`}>{group.title}</Link>{" "}
              <small>
                ({formatDate(dayjs(group.start.toDate()))} to{" "}
                {formatDate(dayjs(group.end.toDate()))})
              </small>
            </span>
            {onManage && (
              <ManageLogButton target={manageTargetForGroup(group)} onManage={onManage} />
            )}
          </li>
        ))}
      </ul>
    </Fragment>
  );
};

export default GroupArchive;
