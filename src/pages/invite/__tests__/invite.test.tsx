import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const state = vi.hoisted(() => ({
  acceptInvite: vi.fn((..._args: unknown[]): Promise<unknown> => Promise.resolve()),
  showToast: vi.fn(),
}));
vi.mock("@/features/invites/invites", () => ({
  acceptInvite: (...args: unknown[]) => state.acceptInvite(...args),
}));
vi.mock("@/hooks/useToastContext", () => ({
  useToastContext: () => ({ showToast: state.showToast }),
}));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));

import { InviteFriendPage } from "..";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("InviteFriendPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    state.acceptInvite.mockReset();
    state.showToast.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const open = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/invite/aB3_-xYz09"]}>
          <Routes>
            <Route path="/invite/:code" element={<InviteFriendPage />} />
            <Route path="/u/:userDocId" element={<p>profile page</p>} />
          </Routes>
        </MemoryRouter>,
      );
    });
  };

  it("accepts the invite once and lands on the inviter's profile", async () => {
    state.acceptInvite.mockResolvedValue({ state: "friends", inviterId: "inviter" });
    await open();
    expect(state.acceptInvite).toHaveBeenCalledTimes(1);
    expect(state.acceptInvite).toHaveBeenCalledWith("aB3_-xYz09");
    expect(document.body.textContent).toContain("profile page");
    expect(state.showToast).toHaveBeenCalledWith("You're friends now", "success");
  });

  it("tells you when it's your own link", async () => {
    state.acceptInvite.mockResolvedValue({ state: "self", inviterId: "me" });
    await open();
    expect(document.body.textContent).toContain("This is your invite link");
  });

  it("explains a link that's no longer valid", async () => {
    state.acceptInvite.mockRejectedValue({ code: "functions/not-found" });
    await open();
    expect(document.body.textContent).toContain("no longer valid");
  });
});
