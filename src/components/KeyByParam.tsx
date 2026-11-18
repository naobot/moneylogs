import { Fragment, ReactNode } from "react";
import { useParams } from "react-router-dom";

/**
 * Remounts its children whenever the route param changes. React Router keeps a route's
 * element mounted from /g/A to /g/B, so without this every hook below carries A's data
 * (and A's "loaded" state) into B until B's arrives: the old log under the new URL, a post
 * link resolved against the wrong posts, and so on. A fresh mount starts every hook at
 * "loading" for the new id.
 */
export const KeyByParam = ({ param, children }: { param: string; children: ReactNode }) => {
  const params = useParams();
  return <Fragment key={params[param] ?? ""}>{children}</Fragment>;
};

export default KeyByParam;
