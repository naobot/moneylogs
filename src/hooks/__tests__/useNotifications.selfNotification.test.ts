import { describe, it, expect } from "vite-plus/test";
import { buildSelfNotification, selfNotificationId } from "@/hooks/useNotifications";

describe("self notifications", () => {
  it("has one id per log and type", () => {
    expect(selfNotificationId("log_created", "g1")).toBe("log_created_g1");
    expect(selfNotificationId("log_joined", "l1")).toBe("log_joined_l1");
  });

  it("carries just what the rules allow a client to create", () => {
    expect(
      buildSelfNotification({
        type: "log_joined",
        groupId: "l1",
        groupName: "Household",
        logKind: "ledger",
      }),
    ).toEqual({ type: "log_joined", groupId: "l1", groupName: "Household", logKind: "ledger" });
  });
});
