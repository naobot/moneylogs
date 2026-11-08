import { Link } from "react-router-dom";

/** Shown for a log link that no longer resolves (deleted, or never existed). */
export const LogNotFound = () => (
  <div className="Content__body">
    <h3>Log not found</h3>
    <p>It may have been deleted by its creator, or the link may be wrong.</p>
    <p>
      <Link to="/">Back home</Link>
    </p>
  </div>
);

export default LogNotFound;
