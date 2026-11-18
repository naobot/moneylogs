import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import Button from "@/components/Button";
import { useMutation } from "@/hooks/useFirebase";
import dayjs from "@/utils/configuredDayjs";
import { reportError } from "@/utils/reportError";

import { AdminUser, adminErrorMessage, adminLookupUser, isExpectedAdminError } from "./adminApi";
import { useIsAdmin } from "./useIsAdmin";
import { GiftSection } from "./GiftSection";
import { LogsSection } from "./LogsSection";
import { DeleteAccountSection } from "./DeleteAccountSection";

import "./AdminPage.scss";

const when = (iso: string | null) => (iso ? dayjs(iso).format("YYYY-MM-DD HH:mm") : "—");

/**
 * Admin tools: look someone up, add knick-knacks, delete their logs or their account.
 * Deletions run the same server cascades as the person's own delete (functions/src/admin.ts).
 * Visible only with the `admin` claim; the callables enforce it regardless.
 */
export const AdminPage = () => {
  const isAdmin = useIsAdmin({ forceRefresh: true });
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lookup = useMutation(async (q: string) => (await adminLookupUser({ query: q })).data);

  const runLookup = async (q: string) => {
    if (!q.trim()) return;
    setLookupError(null);
    try {
      setUser(await lookup.mutate(q.trim()));
    } catch (err) {
      if (!isExpectedAdminError(err)) {
        reportError(err, { feature: "admin", action: "lookup_user" });
      }
      setUser(null);
      setLookupError(adminErrorMessage(err));
    }
  };

  /** Re-read the same account after a change (it may be gone after a delete). */
  const refresh = () => user && void runLookup(user.uid);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runLookup(query);
  };

  if (isAdmin === undefined) return <div className="Window Admin">checking access…</div>;
  if (!isAdmin) {
    return (
      <div className="Window Admin">
        <p>nothing here.</p>
        <Link to="/">back home</Link>
      </div>
    );
  }

  return (
    <div className="Window Admin">
      <div className="Window__heading">
        <h2>admin</h2>
      </div>

      <form className="Admin__lookup" onSubmit={onSubmit}>
        <label htmlFor="admin-query">find account</label>
        <input
          id="admin-query"
          className="LineInput keep-case"
          placeholder="email, user doc id or uid"
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          text={lookup.isLoading ? "Looking…" : "Look up"}
          size="sm"
          loading={lookup.isLoading}
          disabled={!query.trim()}
          onClick={() => void runLookup(query)}
        />
      </form>
      {lookupError && <p className="error-message">{lookupError}</p>}

      {user && (
        <>
          <section className="Admin__section Admin__card" aria-label="account">
            <h3 className="keep-case">{user.displayName ?? "(no name)"}</h3>
            <dl>
              <dt>email</dt>
              <dd className="keep-case">{user.email ?? "—"}</dd>
              <dt>uid</dt>
              <dd className="keep-case">
                {user.uid}
                {!user.authExists && " (no auth account)"}
              </dd>
              <dt>user doc</dt>
              <dd className="keep-case">
                {user.userDocIds.length
                  ? user.userDocIds.map((id) => (
                      <Link key={id} to={`/u/${id}`}>
                        {id}
                      </Link>
                    ))
                  : "—"}
              </dd>
              <dt>joined</dt>
              <dd>{when(user.createdAt)}</dd>
              <dt>last sign-in</dt>
              <dd>{when(user.lastSignInAt)}</dd>
            </dl>
          </section>

          {user.userDocIds[0] && (
            <GiftSection
              userDocId={user.userDocIds[0]}
              inventory={user.knickknacks}
              onChanged={refresh}
            />
          )}

          <LogsSection logs={user.logs} onDeleted={refresh} />

          <DeleteAccountSection
            user={user}
            onDeleted={() => {
              setUser(null);
              setQuery("");
            }}
          />
        </>
      )}
    </div>
  );
};

export default AdminPage;
