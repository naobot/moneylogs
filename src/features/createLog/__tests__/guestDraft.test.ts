import { describe, it, expect, beforeEach } from "vite-plus/test";
import {
  CREATE_LOG_DRAFT_KEY,
  CREATE_LOG_DRAFT_MAX_AGE_MS,
  dropCreateLogDraft,
  keepCreateLogDraft,
  peekCreateLogDraft,
} from "../guestDraft";
import type { WizardState } from "../wizardSteps";

describe("guest create-log draft", () => {
  const state: WizardState = {
    mode: "financial",
    title: "groceries",
    maxParticipants: 4,
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    defaultCurrency: "CAD",
    inviteFriendIds: [],
    parentId: null,
    sublogName: "",
  };
  const NOW = 1_800_000_000_000;

  beforeEach(() => localStorage.clear());

  it("comes back after the save reload, with whose it is", () => {
    keepCreateLogDraft("guest-1", state, NOW);
    expect(peekCreateLogDraft(NOW + 1000)).toEqual({ uid: "guest-1", state });
  });

  it("is gone once dropped", () => {
    keepCreateLogDraft("guest-1", state, NOW);
    dropCreateLogDraft();
    expect(peekCreateLogDraft(NOW)).toBeNull();
  });

  it("ignores one older than an hour", () => {
    keepCreateLogDraft("guest-1", state, NOW);
    expect(peekCreateLogDraft(NOW + CREATE_LOG_DRAFT_MAX_AGE_MS + 1)).toBeNull();
  });

  it("ignores anything malformed", () => {
    for (const raw of ["not json", "{}", JSON.stringify({ uid: "u", savedAt: NOW, state: {} })]) {
      localStorage.setItem(CREATE_LOG_DRAFT_KEY, raw);
      expect(peekCreateLogDraft(NOW)).toBeNull();
    }
  });
});
