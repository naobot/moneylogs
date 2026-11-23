import { useState } from "react";

import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import { useMutation } from "@/hooks/useFirebase";
import dayjs from "@/utils/configuredDayjs";
import { reportError } from "@/utils/reportError";

import { adminCleanupPreview, adminErrorMessage, CleanupPreview } from "./adminApi";

const REASONS = {
  idle_guest: "idle guest",
  idle_unconfirmed: "unconfirmed, no ties",
} as const;

const day = (iso: string | null) => (iso ? dayjs(iso).format("YYYY-MM-DD") : "—");

/**
 * The daily account cleanup's dry run: who it would delete now and why. Read it before
 * switching ACCOUNT_CLEANUP_DELETE on; "look up" opens an account above to check it.
 */
export const CleanupSection = ({ onLookUp }: { onLookUp: (uid: string) => void }) => {
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useMutation(async () => (await adminCleanupPreview()).data);

  const run = async () => {
    setError(null);
    try {
      setPreview(await load.mutate(undefined));
    } catch (err) {
      reportError(err, { feature: "admin", action: "cleanup_preview" });
      setError(adminErrorMessage(err));
    }
  };

  return (
    <section className="Admin__section" aria-label="account cleanup">
      <h3>account cleanup</h3>
      <p>
        Every day, accounts idle for 30+ days are removed if they're guests, or if their email was
        never confirmed and they have no friends, requests or shared logs.
      </p>
      <Button
        text={load.isLoading ? "Checking…" : preview ? "Check again" : "Preview"}
        size="sm"
        variant="secondary"
        loading={load.isLoading}
        onClick={() => void run()}
      />
      {error && <p className="error-message">{error}</p>}
      {preview && (
        <>
          <p className="Admin__muted">
            {preview.deleteEnabled
              ? `deletion is on: up to ${preview.maxPerRun} a day.`
              : "deletion is off: the daily run only logs these."}{" "}
            {preview.candidates.length} account{preview.candidates.length === 1 ? "" : "s"} now.
          </p>
          {preview.candidates.length > 0 && (
            <ul className="Admin__logs">
              {preview.candidates.map((c) => (
                <li key={c.uid}>
                  <span className="Admin__logTitle">
                    <span className="keep-case">{c.email ?? "(guest)"}</span>{" "}
                    <small>
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
