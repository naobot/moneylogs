import { describe, it, expect } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { NotificationItem } from "../NotificationItem";
import { AppNotification } from "@/types/notification";
import { useVisualHarness } from "@/test/visual";
import "../notifications.scss";

const NOW = new Date("2026-11-25T14:00:00Z");
const at = (minutesAgo: number) => Timestamp.fromMillis(NOW.getTime() - minutesAgo * 60_000);

// A mix of short and long lines, unread and read, so wrapping and icons show at each size.
const NOTIFICATIONS = [
  {
    id: "n1",
    type: "comment",
    groupId: "g1",
    groupName: "Kyoto trip",
    logKind: "social",
    postId: "p1",
    commentId: "c1",
    actorId: "u2",
    actorName: "Momo",
    excerpt: "That ramen place was worth every yen, we should go back on the last night",
    createdAt: at(3),
    readAt: null,
  },
  {
    id: "n2",
    type: "budget_exceeded",
    groupId: "l1",
    groupName: "personal",
    logKind: "ledger",
    month: "2026-11",
    currency: "JPY",
    spent: 48200,
    budget: 40000,
    categoryId: "food",
    categoryName: "eating out",
    createdAt: at(90),
    readAt: null,
  },
  {
    id: "n3",
    type: "friend_accepted",
    actorId: "u3",
    actorName: "Alexandria-Rose",
    createdAt: at(60 * 26),
    readAt: at(60 * 20),
  },
  {
    id: "n4",
    type: "scheduled_logged",
    groupId: "l1",
    groupName: "household with a very long name for a log",
    logKind: "ledger",
    entryId: "e1",
    label: "rent",
    amount: 98000,
    currency: "JPY",
    date: "2026-11-25",
    month: "2026-11",
    categoryName: "home",
    createdAt: at(60 * 24 * 4),
    readAt: at(60 * 24 * 3),
  },
] as unknown as AppNotification[];

describe("notifications list (visual)", () => {
  const v = useVisualHarness();

  it("renders the inbox at every text and UI size", async () => {
    v.render(
      <MemoryRouter>
        <ul className="Notifications__list">
          {NOTIFICATIONS.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} fresh={!n.readAt} now={NOW} />
            </li>
          ))}
        </ul>
      </MemoryRouter>,
    );

    expect(v.container.querySelectorAll("li")).toHaveLength(NOTIFICATIONS.length);
    await v.sizes("notifications list");
  });
});
