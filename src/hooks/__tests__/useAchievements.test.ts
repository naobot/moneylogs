import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { getDocs, setDoc } from "firebase/firestore";
import { awardGroupAchievements } from "@/hooks/useAchievements";
import type { LogPost } from "@/types/user";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  // Return an object whose .id is the last path segment — lets us assert on doc IDs
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ id: path[path.length - 1] })),
  getDocs: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => null),
}));

const noExistingAchievements = { docs: [] };
const existingAchievement = (id: string) => ({ docs: [{ id }] });

const makePost = (userId: string, amount: number, currency = "CAD"): LogPost =>
  ({
    id: `post-${userId}-${amount}-${currency}`,
    author: { id: userId },
    currency,
    amount,
    postDate: { seconds: 1705363200, toDate: () => new Date() },
    content: "",
    groupId: "group1",
    createdAt: { seconds: 1705363200, toDate: () => new Date() },
  }) as unknown as LogPost;

// Standard 3-person CAD group: user1=300 (top), user2=200 (middle), user3=100 (lowest)
const threePersonCadPosts = [
  makePost("user1", 300),
  makePost("user2", 200),
  makePost("user3", 100),
];

const baseArgs = { groupId: "group1", groupTitle: "Test Group" };

beforeEach(() => {
  vi.mocked(getDocs)
    .mockClear()
    .mockResolvedValue(noExistingAchievements as never);
  vi.mocked(setDoc).mockClear();
});

describe("awardGroupAchievements — top spender", () => {
  it("awards top_spender to the user with the highest total", async () => {
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: threePersonCadPosts,
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("top_spender");
    expect(result[0].currency).toBe("CAD");
  });

  it("writes the achievement with the correct document ID", async () => {
    await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: threePersonCadPosts,
    });
    const [[ref]] = vi.mocked(setDoc).mock.calls;
    expect((ref as { id: string }).id).toBe("group1__top_spender__CAD");
  });

  it("writes groupId, groupTitle, currency, and type to Firestore", async () => {
    await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: threePersonCadPosts,
    });
    const [[, data]] = vi.mocked(setDoc).mock.calls;
    expect(data).toMatchObject({
      type: "top_spender",
      groupId: "group1",
      groupTitle: "Test Group",
      currency: "CAD",
    });
  });
});

describe("awardGroupAchievements — lowest spender", () => {
  it("awards lowest_spender to the user with the lowest total", async () => {
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user3",
      logPosts: threePersonCadPosts,
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("lowest_spender");
  });
});

describe("awardGroupAchievements — ineligible cases", () => {
  it("awards nothing when fewer than 3 users have posted in a currency", async () => {
    const twoPerson = [makePost("user1", 300), makePost("user2", 100)];
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: twoPerson,
    });
    expect(result).toHaveLength(0);
    expect(vi.mocked(setDoc)).not.toHaveBeenCalled();
  });

  it("awards nothing to a user in the middle of the rankings", async () => {
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user2",
      logPosts: threePersonCadPosts,
    });
    expect(result).toHaveLength(0);
  });

  it("returns an empty array and skips Firestore when there are no posts", async () => {
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: [],
    });
    expect(result).toHaveLength(0);
    expect(vi.mocked(getDocs)).not.toHaveBeenCalled();
  });
});

describe("awardGroupAchievements — duplicate prevention", () => {
  it("does not re-award an achievement the user already holds", async () => {
    vi.mocked(getDocs).mockResolvedValue(existingAchievement("group1__top_spender__CAD") as never);
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: threePersonCadPosts,
    });
    expect(result).toHaveLength(0);
    expect(vi.mocked(setDoc)).not.toHaveBeenCalled();
  });
});

describe("awardGroupAchievements — multi-currency", () => {
  it("tracks each currency's 3+ participant threshold independently", async () => {
    // user3 only posts in CAD, so USD has only 2 participants → no USD awards
    const mixedPosts = [
      makePost("user1", 300, "CAD"),
      makePost("user1", 50, "USD"),
      makePost("user2", 200, "CAD"),
      makePost("user2", 200, "USD"),
      makePost("user3", 100, "CAD"), // CAD: 3 participants; USD: only 2
    ];
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: mixedPosts,
    });
    // CAD: 3 participants, user1 is top → awarded; USD: 2 participants → skipped
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe("CAD");
  });

  it("can award achievements in multiple currencies in one call", async () => {
    // user1: top in CAD (300), lowest in USD (50); both currencies have 3+ participants
    const multiCurrencyPosts = [
      makePost("user1", 300, "CAD"),
      makePost("user1", 50, "USD"),
      makePost("user2", 200, "CAD"),
      makePost("user2", 200, "USD"),
      makePost("user3", 100, "CAD"),
      makePost("user3", 400, "USD"),
    ];
    const result = await awardGroupAchievements({
      ...baseArgs,
      userId: "user1",
      logPosts: multiCurrencyPosts,
    });
    expect(result).toHaveLength(2);
    const types = result.map((a) => a.type).sort();
    expect(types).toEqual(["lowest_spender", "top_spender"]);
  });
});
