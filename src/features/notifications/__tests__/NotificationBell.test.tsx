import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import type { AppNotification } from "@/types/notification";

let latest: { items: AppNotification[]; unreadCount: number } = { items: [], unreadCount: 0 };
const markNotificationRead = vi.fn(async () => {});

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "u1", userId: "auth1" } }),
}));
vi.mock("@/hooks/useNotifications", () => ({
  useLatestNotifications: () => latest,
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...(args as [])),
}));

import { NotificationBell, POPUP_LIMIT } from "@/features/notifications/NotificationBell";
import { HOVER_OPEN_DELAY } from "@/hooks/useHoverIntent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const note = (i: number, read = false) =>
  ({
    id: `n${i}`,
    type: "log_joined",
    groupId: `g${i}`,
    groupName: `Log ${i}`,
    createdAt: Timestamp.fromDate(new Date("2026-11-10T00:00:00Z")),
    readAt: read ? Timestamp.fromDate(new Date("2026-11-10T01:00:00Z")) : null,
  }) as AppNotification;

describe("NotificationBell", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    markNotificationRead.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (path = "/") =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <NotificationBell />
        </MemoryRouter>,
      ),
    );
  const bell = () => container.querySelector(".NotificationBell")!;
  const link = () => container.querySelector<HTMLAnchorElement>(".NotificationBell a")!;
  const popup = () => document.querySelector(".NotificationPopup");
  const hover = (pointerType = "mouse") =>
    act(() => {
      link().dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType }));
    });

  it("links to /notifications and shows no badge when everything is read", () => {
    latest = { items: [note(1, true)], unreadCount: 0 };
    render();
    expect(link().getAttribute("href")).toBe("/notifications");
    expect(link().getAttribute("aria-label")).toBe("Notifications");
    expect(bell().querySelector(".NotificationBell__badge")).toBeNull();
  });

  it("badges the unread count, capped at 9+", () => {
    latest = { items: [note(1)], unreadCount: 3 };
    render();
    expect(bell().querySelector(".NotificationBell__badge")!.textContent).toBe("3");
    expect(link().getAttribute("aria-label")).toBe("Notifications, 3 unread");

    latest = { items: [note(1)], unreadCount: 14 };
    render();
    expect(bell().querySelector(".NotificationBell__badge")!.textContent).toBe("9+");
  });

  it("opens the pop-up only after hovering for a beat", () => {
    latest = { items: Array.from({ length: 10 }, (_, i) => note(i)), unreadCount: 10 };
    render();
    hover();
    act(() => vi.advanceTimersByTime(HOVER_OPEN_DELAY - 1));
    expect(popup()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(popup()).not.toBeNull();
    expect(popup()!.querySelectorAll(".NotificationItem")).toHaveLength(POPUP_LIMIT);
    expect(popup()!.querySelector(".NotificationPopup__all")!.getAttribute("href")).toBe(
      "/notifications",
    );
  });

  it("ignores touch hovers, so a tap just navigates", () => {
    latest = { items: [note(1)], unreadCount: 1 };
    render();
    hover("touch");
    act(() => vi.advanceTimersByTime(HOVER_OPEN_DELAY));
    expect(popup()).toBeNull();
  });

  it("doesn't open on the notifications page itself", () => {
    latest = { items: [note(1)], unreadCount: 1 };
    render("/notifications");
    hover();
    act(() => vi.advanceTimersByTime(HOVER_OPEN_DELAY));
    expect(popup()).toBeNull();
  });

  it("marks a notification read when it's clicked", () => {
    latest = { items: [note(1)], unreadCount: 1 };
    render();
    hover();
    act(() => vi.advanceTimersByTime(HOVER_OPEN_DELAY));
    const item = popup()!.querySelector<HTMLAnchorElement>(".NotificationItem")!;
    expect(item.getAttribute("href")).toBe("/g/g1");
    act(() => item.click());
    expect(markNotificationRead).toHaveBeenCalledWith("u1", latest.items[0]);
  });

  it("says so when there's nothing yet", () => {
    latest = { items: [], unreadCount: 0 };
    render();
    hover();
    act(() => vi.advanceTimersByTime(HOVER_OPEN_DELAY));
    expect(popup()!.textContent).toContain("nothing yet");
  });
});
