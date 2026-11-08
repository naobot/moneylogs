import { Link, useParams } from "react-router-dom";

import { useGetLedger } from "@/hooks/useGetLedger";
import { Ledger } from "@/features/ledger/components/Ledger";

export const LedgerPage = () => {
  const { ledgerId } = useParams();
  const { ledger, isLoading, isSuccess, isDenied, isNotFound, isError } = useGetLedger(ledgerId);

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

  return isSuccess && ledger ? <Ledger ledger={ledger} /> : null;
};
