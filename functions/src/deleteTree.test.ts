import { describe, it, expect, vi } from "vite-plus/test";
import { deleteTreeRootLast } from "./deleteTree";

/** A user doc with two subcollections; deleting `failing` fails on the first try. */
const setup = (failFirst: string | null) => {
  const left = new Set(["users/u1", "users/u1/notifications/n1", "users/u1/achievements/a1"]);
  const collections = [{ path: "users/u1/notifications" }, { path: "users/u1/achievements" }];
  let failed = false;
  const db = {
    recursiveDelete: vi.fn(async (col: { path: string }) => {
      if (col.path === failFirst && !failed) {
        failed = true;
        throw new Error("1 delete failed");
      }
      for (const p of left) if (p.startsWith(`${col.path}/`)) left.delete(p);
    }),
  };
  const ref = {
    listCollections: vi.fn(async () => collections),
    delete: vi.fn(async () => {
      left.delete("users/u1");
    }),
  };
  return { db, ref, left };
};

describe("deleteTreeRootLast", () => {
  it("deletes everything under the document, then the document", async () => {
    const { db, ref, left } = setup(null);
    await deleteTreeRootLast(db as never, ref as never);
    expect(left.size).toBe(0);
  });

  it("keeps the document when something under it fails, so a retry can find it", async () => {
    const { db, ref, left } = setup("users/u1/notifications");
    await expect(deleteTreeRootLast(db as never, ref as never)).rejects.toThrow("1 delete failed");
    // The other subcollection is still cleared; the document and the failed part stay.
    expect([...left].sort()).toEqual(["users/u1", "users/u1/notifications/n1"]);
    expect(ref.delete).not.toHaveBeenCalled();

    // The retry (the caller finds users/u1 again by query) finishes the job.
    await deleteTreeRootLast(db as never, ref as never);
    expect(left.size).toBe(0);
  });
});
