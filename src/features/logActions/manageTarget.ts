import { Group } from "@/types/user";
import { Ledger } from "@/types/ledger";
import { creatorUid } from "@/utils/logOwnership";

import type { LogKind } from "./LogActionsModal";

/** Everything LogActionsModal needs to manage one log from a list. */
export type ManageTarget = {
  id: string;
  title: string;
  kind: LogKind;
  creatorUid?: string;
};

export const manageTargetForGroup = (group: Group): ManageTarget => ({
  id: group.id,
  title: group.title,
  kind: "social",
  creatorUid: creatorUid(group, "social"),
});

export const manageTargetForLedger = (ledger: Ledger): ManageTarget => ({
  id: ledger.id,
  title: ledger.title,
  kind: "financial",
  creatorUid: creatorUid(ledger, "financial"),
});
