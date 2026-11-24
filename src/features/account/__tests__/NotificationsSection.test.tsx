import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  user: { id: "doc1", userId: "a1" } as Record<string, unknown>,
  emailVerified: true,
  updateUserFields: vi.fn((..._args: unknown[]) => Promise.resolve()),
  showToast: vi.fn(),
}));

vi.mock("@/config/firebase-config", () => ({ auth: {} }));
vi.mock("react-firebase-hooks/auth", () => ({
  useAuthState: () => [{ email: "me@example.com", emailVerified: state.emailVerified }],
}));
vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user: state.user }) }));
vi.mock("@/hooks/useToastContext", () => ({
  useToastContext: () => ({ showToast: state.showToast }),
}));
vi.mock("@/hooks/useUserQuery", () => ({ updateUserFields: state.updateUserFields }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("@/features/push/devicePush", () => ({ pushAvailable: () => false }));

import { NotificationsSection } from "../NotificationsSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("NotificationsSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = () => act(() => root.render(<NotificationsSection />));
  const select = (key: string) => container.querySelector<HTMLSelectElement>(`#notif-pref-${key}`)!;
  const change = (el: HTMLSelectElement | HTMLInputElement, value?: string) =>
    act(() => {
      if (el instanceof HTMLSelectElement) {
        el.value = value!;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        el.click();
      }
    });

  beforeEach(() => {
    state.user = { id: "doc1", userId: "a1" };
    state.emailVerified = true;
    state.updateUserFields.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows each type's channel, with defaults for unset prefs", () => {
    render();
    expect(select("log_ending").value).toBe("email");
    expect(select("comment").value).toBe("inbox");
    expect(select("budget_category").value).toBe("off");
    expect(select("log_created").querySelector('option[value="email"]')).toBeNull();
    expect(container.textContent).toContain("me@example.com");
  });

  it("saves a channel change as dotted keys on the user doc", async () => {
    render();
    await change(select("comment"), "email");
    expect(state.updateUserFields).toHaveBeenCalledWith("doc1", {
      "notificationPrefs.comment": true,
      "emailPrefs.comment": true,
    });
  });

  it("pauses and resumes the digest", async () => {
    render();
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.checked).toBe(true);
    await change(box);
    expect(state.updateUserFields).toHaveBeenCalledWith("doc1", { emailPaused: true });
  });

  it("asks unverified users to verify first", () => {
    state.emailVerified = false;
    render();
    expect(container.textContent).toContain("Verify your email address");
  });
});
