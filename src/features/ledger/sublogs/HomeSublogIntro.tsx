import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/contexts";
import { useLedgerHasEntries } from "@/hooks/useLedgerHasEntries";
import { personalLedgerId } from "@/utils/personalLedger";
import { readyForSublogIntro, shouldAutoOpenSublogIntro } from "@/utils/sublogs";
import SublogIntro from "./SublogIntro";

/**
 * Announces sublogs on Home: the "what's a sublog?" slides open once, the first time
 * someone who has already logged something comes to Home. Brand-new users get it on a
 * later visit, after their first entry. The same seen-flag (tutorials.sublogIntro)
 * means the other places it can open by itself (the wizard, Manage, a sublog) don't
 * repeat it.
 */
export const HomeSublogIntro = ({ ledgerIds }: { ledgerIds: ReadonlyArray<string> }) => {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [closed, setClosed] = useState(false);
  const unseen = shouldAutoOpenSublogIntro(user);
  const personalId = user ? personalLedgerId(user.userId) : undefined;
  // Only someone with nothing but their personal log needs the entries check.
  const onlyPersonal = ledgerIds.every((id) => id === personalId);
  const personalHasEntries = useLedgerHasEntries(
    personalId,
    unseen && onlyPersonal && ledgerIds.length > 0,
  );

  const ready = readyForSublogIntro({ ledgerIds, personalId, personalHasEntries });
  return (
    <SublogIntro
      isOpen={unseen && ready && !closed}
      from="home"
      onClose={() => setClosed(true)}
      onStart={() => navigate("/create")}
    />
  );
};

export default HomeSublogIntro;
