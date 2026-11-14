import { useState } from "react";
import { useLocation } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useGetLedger } from "@/hooks/useGetLedger";
import { updateUserFields } from "@/hooks/useUserQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { Currency } from "@/types/user";
import { isCurrency } from "@/utils/currency";
import { preferredCurrency } from "@/utils/personalLedger";
import { reportError } from "@/utils/reportError";

import Button from "@/components/Button";
import CurrencySelect from "@/components/CurrencySelect";
import Modal from "@/components/Modal";

import { needsDefaultCurrencyPrompt } from "./currencyPromptRules";

/**
 * Asks an existing account, once, which currency is theirs. It's pre-filled from their
 * personal log (else what they last used), and "Not now" keeps that guess, so nobody is
 * asked twice. They can change it any time under /me → Profile.
 */
export const DefaultCurrencyPrompt = () => {
  const { user } = useCurrentUser();
  const { pathname } = useLocation();
  const { showToast } = useToastContext();

  const wanted = needsDefaultCurrencyPrompt(user, pathname);
  // Wait for the personal log (if any) before showing, both to pre-fill from it and so a
  // stale cached profile has time to be replaced by the live one.
  const { ledger, isSuccess, isNotFound, isDenied, isError } = useGetLedger(
    user?.personalLedgerId,
    wanted,
  );
  const ledgerSettled = !user?.personalLedgerId || isSuccess || isNotFound || isDenied || isError;

  // Only an explicit pick is state; until then the select shows the inferred guess.
  const [picked, setPicked] = useState<Currency>();
  const [saving, setSaving] = useState(false);

  if (!wanted || !ledgerSettled || !user) return null;

  const guess = isCurrency(ledger?.defaultCurrency)
    ? ledger.defaultCurrency
    : preferredCurrency(user);
  const choice = picked ?? guess;

  // "Not now" (and closing) keeps the inferred guess, so the prompt only ever shows once.
  const save = async (defaultCurrency: Currency) => {
    setSaving(true);
    try {
      await updateUserFields(user.id, { defaultCurrency });
    } catch (err) {
      reportError(err, {
        feature: "default_currency",
        action: "save_default_currency",
        tags: { choice: defaultCurrency === guess ? "kept_guess" : "changed" },
      });
      showToast("Couldn't save your currency. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={saving ? undefined : () => void save(guess)} disabled={saving}>
      <Modal.Header title="your currency" striped />
      <Modal.Body>
        <p>
          Which currency do you usually spend in? New logs start in it, and new posts use it when
          you haven&apos;t picked one on this device yet.
        </p>
        <CurrencySelect
          id="prompt-default-currency"
          label="Default currency"
          value={choice}
          onChange={setPicked}
          disabled={saving}
        />
        <p>You can change this any time in your profile.</p>
      </Modal.Body>
      <Modal.Actions>
        <Button
          text="Not now"
          buttonStyle="primary-border-lite"
          disabled={saving}
          onClick={() => void save(guess)}
        />
        <Button
          text="Save"
          buttonStyle="primary-border"
          loading={saving}
          onClick={() => void save(choice)}
        />
      </Modal.Actions>
    </Modal>
  );
};

export default DefaultCurrencyPrompt;
