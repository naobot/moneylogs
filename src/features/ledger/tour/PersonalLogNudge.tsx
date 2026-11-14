import { Link } from "react-router-dom";
import { serverTimestamp } from "firebase/firestore";

import { useCurrentUser } from "@/contexts";
import { useLedgerHasEntries } from "@/hooks/useLedgerHasEntries";
import { updateUserFields } from "@/hooks/useUserQuery";
import { personalLedgerId } from "@/utils/personalLedger";
import RowButton from "@/components/RowButton";
import { reportError } from "@/utils/reportError";

import { shouldShowLedgerNudge } from "./tourRules";

import "./PersonalLogNudge.scss";

/**
 * A one-time pointer on Home to a personal log that hasn't been used yet. Following it
 * (the tour runs there) or dismissing it records that on the user doc.
 */
export const PersonalLogNudge = ({ ledgerIds }: { ledgerIds: readonly string[] }) => {
  const { user } = useCurrentUser();
  const candidate = shouldShowLedgerNudge({ user, ledgerIds, hasEntries: false });
  const hasEntries = useLedgerHasEntries(
    user ? personalLedgerId(user.userId) : undefined,
    candidate,
  );

  if (!user || !shouldShowLedgerNudge({ user, ledgerIds, hasEntries })) return null;

  const seen = () => {
    updateUserFields(user.id, { "tutorials.ledgerNudge": serverTimestamp() }).catch(
      (err: unknown) =>
        reportError(err, { feature: "ledger_tour", action: "record_nudge", level: "warning" }),
    );
  };

  return (
    <aside className="PersonalLogNudge" aria-label="Your personal log">
      <p>
        <strong>your personal log is ready.</strong> Track everyday spending in it, just for you.
      </p>
      <Link to={`/l/${personalLedgerId(user.userId)}`} onClick={seen}>
        take the 1-minute tour ›
      </Link>
      <RowButton glyph aria-label="Dismiss" onClick={seen}>
        ×
      </RowButton>
    </aside>
  );
};

export default PersonalLogNudge;
