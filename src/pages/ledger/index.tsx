import { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { useGetLedger } from "@/hooks/useGetLedger";
import { useStampLogVisit } from "@/hooks/useStampLogVisit";
import { Ledger as LedgerType } from "@/types/ledger";
import { Ledger } from "@/features/ledger/components/Ledger";
import { LedgerStatsView } from "@/features/ledger/components/LedgerStatsView";

/** Loads the ledger and handles the private / not-found / error states for its pages. */
const LedgerRoute = ({ render }: { render: (ledger: LedgerType) => ReactNode }) => {
  const { ledgerId } = useParams();
  const { ledger, isLoading, isSuccess, isDenied, isNotFound, isError } = useGetLedger(ledgerId);
  // Only members can read a ledger, so a loaded ledger means a member is looking at it.
  useStampLogVisit(isSuccess && ledger ? ledgerId : undefined);

  if (isLoading) return <div className="InfoBox">...</div>;

  if (isDenied || isNotFound) {
    return (
      <div className="Content__body">
        <h3>{isDenied ? "This financial log is private" : "Financial log not found"}</h3>
        <p>
          {isDenied
            ? "Only its members can see it. If you've been invited, use the invite link you were sent."
            : "It may have been removed, or the link may be wrong."}
        </p>
        <p>
          <Link to="/">Back home</Link>
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="error-message">Failed to load this financial log. Please try again.</div>
    );
  }

  return isSuccess && ledger ? <>{render(ledger)}</> : null;
};

export const LedgerPage = () => <LedgerRoute render={(ledger) => <Ledger ledger={ledger} />} />;

export const LedgerStatsPage = () => (
  <LedgerRoute render={(ledger) => <LedgerStatsView ledger={ledger} />} />
);
