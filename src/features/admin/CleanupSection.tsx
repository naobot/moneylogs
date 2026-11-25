import { useEffect, useState } from "react";

import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import { useToastContext } from "@/hooks/useToastContext";
import dayjs from "@/utils/configuredDayjs";
import { reportError } from "@/utils/reportError";

import {
  adminCleanupDelete,
  adminCleanupList,
  adminErrorMessage,
  CleanupCandidate,
  CleanupList,
  isExpectedAdminError,
} from "./adminApi";

const REASONS = {
  idle_guest: "idle guest",
  idle_unconfirmed: "unconfirmed, no ties",
} as const;

const day = (iso: string | null) => (iso ? dayjs(iso).format("YYYY-MM-DD") : "—");

/**
 * The account cleanup list, built every day (functions/src/accountCleanup.ts). Nothing is
 * deleted automatically: each account goes only when an admin deletes it here, and the
 * server checks it again first. "look up" opens the account above to check it.
 */
export const CleanupSection = ({ onLookUp }: { onLookUp: (uid: string) => void }) => {
  const { showToast } = useToastContext();
  const [list, setList] = useState<CleanupList | null>(null);
  // Loading the stored list on mount.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const failed = (err: unknown) => {
    reportError(err, { feature: "admin", action: "cleanup_list" });
    setError(adminErrorMessage(err));
  };

  useEffect(() => {
    let live = true;
    adminCleanupList({})
      .then(({ data }) => live && setList(data))
      .catch((err) => live && failed(err))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  /** Build the list again now, rather than wait for the daily run. */
  const refresh = async () => {
    setError(null);
    setLoading(true);
    try {
      setList((await adminCleanupList({ refresh: true })).data);
    } catch (err) {
      failed(err);
    } finally {
      setLoading(false);
    }
  };

  const unlist = (uid: string) =>
    setList((current) =>
      current
        ? {
            ...current,
            candidates: current.candidates.filter((c) => c.uid !== uid),
            total: Math.max(0, current.total - 1),
          }
        : current,
    );

  const remove = async (c: CleanupCandidate) => {
    const who = c.email ?? `guest ${c.uid}`;
    const question = c.unfinished
      ? `Finish deleting ${who}? It stopped partway, so some of their logs may already be gone.`
      : `Delete ${who} and everything they logged? This can't be undone.`;
    if (!window.confirm(question)) return;
    setDeleting(c.uid);
    try {
      const { data } = await adminCleanupDelete({ uid: c.uid });
      unlist(c.uid);
      if (data.deleted) showToast(`Deleted ${who}`, "success");
      else if (data.reason === "kept") {
        showToast(`Kept ${who}: they came back or made ties since the list was built.`);
      } else showToast(`${who} no longer exists.`);
    } catch (err) {
      if (!isExpectedAdminError(err)) {
        reportError(err, { feature: "admin", action: "cleanup_delete" });
      }
      showToast(adminErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className="Admin__section" aria-label="account cleanup">
      <h3>account cleanup</h3>
      <p>
        Every day, accounts idle for 30+ days are listed here if they're guests, or if their email
        was never confirmed and they have no friends, requests or shared logs. Nothing is deleted
        until you delete it.
      </p>
      <Button
        text={loading ? "Checking…" : "Refresh now"}
        size="sm"
        variant="secondary"
        loading={loading}
        onClick={() => void refresh()}
      />
      {error && <p className="error-message">{error}</p>}
      {list && (
        <>
          <p className="Admin__muted">
            {list.listedAt
              ? `listed ${dayjs(list.listedAt).format("YYYY-MM-DD HH:mm")}: ${list.total} account${
                  list.total === 1 ? "" : "s"
                }${list.total > list.candidates.length ? `, first ${list.candidates.length} shown` : ""}.`
              : "not listed yet: the first daily run hasn't happened."}
          </p>
          {list.candidates.length > 0 && (
            <ul className="Admin__logs">
              {list.candidates.map((c) => (
                <li key={c.uid}>
                  <span className="Admin__logTitle">
                    <span className="keep-case">{c.email ?? "(guest)"}</span>{" "}
                    <small>
                      {c.unfinished && <strong>deletion stopped partway · </strong>}
                      {REASONS[c.reason]} · joined {day(c.createdAt)} · last seen{" "}
                      {day(c.lastActiveAt)}
                    </small>
                  </span>
                  <RowButton
                    aria-label={`Look up ${c.email ?? c.uid}`}
                    onClick={() => onLookUp(c.uid)}
                  >
                    look up
                  </RowButton>
                  <RowButton
                    aria-label={`Delete ${c.email ?? c.uid}`}
                    disabled={deleting !== null}
                    onClick={() => void remove(c)}
                  >
                    {deleting === c.uid ? "deleting…" : c.unfinished ? "finish deleting" : "delete"}
                  </RowButton>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default CleanupSection;
