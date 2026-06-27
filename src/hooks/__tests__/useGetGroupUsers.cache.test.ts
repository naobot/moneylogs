import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { getCachedUsers, setCachedUsers, CacheableUserData } from "@/hooks/useGetGroupUsers";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn(),
  DocumentSnapshot: class {},
}));

const GROUP_ID = "group_abc";
const CACHE_KEY = `groupUsers_${GROUP_ID}`;

const mockUsers: CacheableUserData[] = [
  {
    id: "user1",
    userId: "auth_user1",
    displayName: "Alice",
    email: "alice@example.com",
    groups: [GROUP_ID],
  },
  {
    id: "user2",
    userId: "auth_user2",
    displayName: "Bob",
    email: "bob@example.com",
    groups: [GROUP_ID],
  },
];

describe("useGetGroupUsers cache utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCachedUsers", () => {
    it("returns null when there is no cached entry", () => {
      expect(getCachedUsers(GROUP_ID)).toBeNull();
    });

    it("returns the cached users when the entry is fresh", () => {
      setCachedUsers(GROUP_ID, mockUsers);
      const result = getCachedUsers(GROUP_ID);
      expect(result).toHaveLength(2);
      expect(result![0].displayName).toBe("Alice");
    });

    it("returns null and removes the key when the cache has expired", () => {
      const expiredTimestamp = Date.now() - 16 * 60 * 1000; // 16 min ago, TTL is 15 min
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: mockUsers, timestamp: expiredTimestamp }),
      );
      expect(getCachedUsers(GROUP_ID)).toBeNull();
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it("returns null and does not throw when localStorage contains invalid JSON", () => {
      localStorage.setItem(CACHE_KEY, "not-valid-json{{{");
      expect(getCachedUsers(GROUP_ID)).toBeNull();
    });
  });

  describe("setCachedUsers", () => {
    it("writes user data with a timestamp to localStorage", () => {
      const before = Date.now();
      setCachedUsers(GROUP_ID, mockUsers);
      const after = Date.now();

      const raw = localStorage.getItem(CACHE_KEY);
      expect(raw).not.toBeNull();

      const { data, timestamp } = JSON.parse(raw!);
      expect(data).toHaveLength(2);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("overwrites a previous cache entry", () => {
      setCachedUsers(GROUP_ID, mockUsers);
      const single = [mockUsers[0]];
      setCachedUsers(GROUP_ID, single);
      const result = getCachedUsers(GROUP_ID);
      expect(result).toHaveLength(1);
      expect(result![0].id).toBe("user1");
    });
  });
});
