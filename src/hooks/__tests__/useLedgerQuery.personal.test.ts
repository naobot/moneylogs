import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("@/config/firebase-config", () => ({ db: {} }));

const store = new Map<string, Record<string, unknown>>();
const writes: Array<{ op: string; path: string; data: Record<string, unknown> }> = [];

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
  collection: vi.fn(),
  addDoc: vi.fn(),
  arrayUnion: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: () => "SERVER_TS",
  runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
    fn({
      get: async (ref: { path: string }) => ({
        exists: () => store.has(ref.path),
        data: () => store.get(ref.path),
      }),
      set: (ref: { path: string }, data: Record<string, unknown>) =>
        writes.push({ op: "set", path: ref.path, data }),
      update: (ref: { path: string }, data: Record<string, unknown>) =>
        writes.push({ op: "update", path: ref.path, data }),
    }),
}));

import { ensurePersonalLedger } from "@/hooks/useLedgerQuery";

const member = { uid: "auth-uid", userDocId: "user-doc" };
const ensure = (defaultCurrency: "CAD" | "JPY" = "CAD") =>
  ensurePersonalLedger({ member, defaultCurrency });

describe("ensurePersonalLedger", () => {
  beforeEach(() => {
    store.clear();
    writes.length = 0;
    store.set("users/user-doc", { userId: "auth-uid" });
  });

  it("creates a 1-member ledger called 'personal' and marks the user", async () => {
    await expect(ensure()).resolves.toBe("personal-auth-uid");
    expect(writes).toHaveLength(2);
    const [ledger, user] = writes;
    expect(ledger.op).toBe("set");
    expect(ledger.path).toBe("ledgers/personal-auth-uid");
    expect(ledger.data).toMatchObject({
      title: "personal",
      max_participants: 1,
      defaultCurrency: "CAD",
      memberUids: ["auth-uid"],
      createdBy: "auth-uid",
      members: [{ path: "users/user-doc" }],
      createdAt: "SERVER_TS",
    });
    expect(user).toEqual({
      op: "update",
      path: "users/user-doc",
      data: { personalLedgerId: "personal-auth-uid" },
    });
  });

  it("doesn't overwrite a ledger another tab already created", async () => {
    store.set("ledgers/personal-auth-uid", { title: "renamed" });
    await expect(ensure()).resolves.toBeNull();
    expect(writes).toEqual([
      { op: "update", path: "users/user-doc", data: { personalLedgerId: "personal-auth-uid" } },
    ]);
  });

  it("never recreates a personal ledger the user deleted", async () => {
    store.set("users/user-doc", { userId: "auth-uid", personalLedgerId: "personal-auth-uid" });
    await expect(ensure()).resolves.toBeNull();
    expect(writes).toEqual([]);
  });
});
