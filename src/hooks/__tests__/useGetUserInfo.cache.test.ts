import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { getCachedUser, setCachedUser, CacheableUserData } from "@/hooks/useGetUserInfo";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: class {},
}));
vi.mock("./useFirebase", () => ({ useFirebaseCollection: vi.fn() }));

const USER_ID = "auth_abc123";
const CACHE_KEY = `currentUser_${USER_ID}`;

const mockUser: CacheableUserData = {
  id: "doc_abc123",
  userId: USER_ID,
  displayName: "Alice",
  email: "alice@example.com",
  createdAt: { seconds: 1700000000, nanoseconds: 0 },
  currentLogId: "log_1",
};

describe("useGetUserInfo cache utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCachedUser", () => {
    it("returns null when there is no cached entry", () => {
      expect(getCachedUser(USER_ID)).toBeNull();
    });

    it("returns the user when the cache is fresh", () => {
      setCachedUser(USER_ID, mockUser);
      const result = getCachedUser(USER_ID);
      expect(result).not.toBeNull();
      expect(result!.displayName).toBe("Alice");
    });

    it("returns null and removes the key when the cache is older than 1 hour", () => {
      const expiredTimestamp = Date.now() - 61 * 60 * 1000; // 61 min ago, TTL is 60 min
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: mockUser, timestamp: expiredTimestamp }),
      );
      expect(getCachedUser(USER_ID)).toBeNull();
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it("returns null and does not throw when localStorage contains invalid JSON", () => {
      localStorage.setItem(CACHE_KEY, "{{broken");
      expect(getCachedUser(USER_ID)).toBeNull();
    });
  });

  describe("setCachedUser", () => {
    it("writes user data with a timestamp to localStorage", () => {
      const before = Date.now();
      setCachedUser(USER_ID, mockUser);
      const after = Date.now();

      const raw = localStorage.getItem(CACHE_KEY);
      expect(raw).not.toBeNull();

      const { data, timestamp } = JSON.parse(raw!);
      expect(data.displayName).toBe("Alice");
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("overwrites a stale cached entry with fresh data", () => {
      const staleTimestamp = Date.now() - 61 * 60 * 1000;
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data: { ...mockUser, displayName: "Old Name" },
          timestamp: staleTimestamp,
        }),
      );
      setCachedUser(USER_ID, mockUser);
      const result = getCachedUser(USER_ID);
      expect(result!.displayName).toBe("Alice");
    });
  });
});
