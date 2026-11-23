import { useState } from "react";

import { useLedgerQuery } from "@/hooks/useLedgerQuery";
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { MAX_LEDGER_TITLE_LENGTH } from "@/utils/ledger";
import { logKindParam, track } from "@/utils/analytics";
import { reportError } from "@/utils/reportError";

import Button from "@/components/Button";

import type { LogKind } from "./LogActionsModal";

/** Why `title` can't be saved, or undefined when it can. Same limit as the create wizard. */
const renameError = (title: string): string | undefined => {
  const trimmed = title.trim();
  if (!trimmed) return "A log needs a name.";
  if (trimmed.length > MAX_LEDGER_TITLE_LENGTH)
    return `Names are ${MAX_LEDGER_TITLE_LENGTH} characters or fewer.`;
  return undefined;
};

type LogTitleSectionProps = {
  logId: string;
  logTitle: string;
  kind: LogKind;
};

/**
 * Renames the log, in its Manage modal. Only its creator sees this. The new name shows
 * for everyone straight away; things already written under the old name (notifications,
 * a sublog's line in its parent) keep it.
 */
export const LogTitleSection = ({ logId, logTitle, kind }: LogTitleSectionProps) => {
  const { showToast } = useToastContext();
  const { updateLedgerTitle } = useLedgerQuery();
  const { updateLogGroupTitle } = useLogGroupQuery();
  const rename = kind === "financial" ? updateLedgerTitle : updateLogGroupTitle;

  const [draft, setDraft] = useState(logTitle);
  const [failed, setFailed] = useState(false);
  // A rename from elsewhere (or this one landing) resets the field to the live name.
  const [shownTitle, setShownTitle] = useState(logTitle);
  if (logTitle !== shownTitle) {
    setShownTitle(logTitle);
    setDraft(logTitle);
  }

  const error = renameError(draft);
  const unchanged = draft.trim() === logTitle.trim();
  const canSave = !error && !unchanged && !rename.isLoading;

  const save = async () => {
    if (!canSave) return;
    const title = draft.trim();
    setFailed(false);
    try {
      if (kind === "financial") await updateLedgerTitle.mutate({ ledgerId: logId, title });
      else await updateLogGroupTitle.mutate({ groupId: logId, title });
      track("rename_log", { log_kind: logKindParam(kind) });
      showToast(`Renamed to ${title}`, "success");
    } catch (err) {
      reportError(err, { feature: "log_actions", action: "rename_log", tags: { kind } });
      setFailed(true);
    }
  };

  return (
    <section className="LogActions__section">
      <h4>name</h4>
      <div className="LogActions__rename">
        <input
          className="LineInput keep-case"
          aria-label="log name"
          value={draft}
          maxLength={MAX_LEDGER_TITLE_LENGTH}
          autoComplete="off"
          disabled={rename.isLoading}
          onChange={(e) => {
            setDraft(e.target.value);
            setFailed(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
        />
        <Button
          text="Save"
          size="sm"
          variant="secondary"
          loading={rename.isLoading}
          disabled={!canSave}
          onClick={() => void save()}
        />
      </div>
      {error && !unchanged && <p className="error-message">{error}</p>}
      {failed && <p className="error-message">Couldn't rename the log. Please try again.</p>}
    </section>
  );
};

export default LogTitleSection;
