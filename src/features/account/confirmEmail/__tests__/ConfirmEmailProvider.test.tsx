import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act, useEffect } from "react";
import { createRoot, Root } from "react-dom/client";

type FakeUser = {
  emailVerified: boolean;
  metadata: { creationTime: string };
  reload: () => Promise<void>;
  getIdToken: () => Promise<string>;
};
const state = vi.hoisted(() => ({ auth: { currentUser: null as FakeUser | null } }));
vi.mock("@/config/firebase-config", () => ({ auth: state.auth }));
vi.mock("react-firebase-hooks/auth", () => ({ useAuthState: () => [state.auth.currentUser] }));
vi.mock("firebase/auth", () => ({
  onIdTokenChanged: () => () => undefined,
  sendEmailVerification: vi.fn(),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("@/utils/analytics", () => ({ track: vi.fn() }));

import { ConfirmEmailProvider } from "../ConfirmEmailProvider";
import { useConfirmEmail } from "../confirmEmailContext";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let ctx: ReturnType<typeof useConfirmEmail>;
const Probe = () => {
  const value = useConfirmEmail();
  useEffect(() => {
    ctx = value;
  });
  return <span id="confirmed">{String(value.confirmed)}</span>;
};

/** Made after the grandfathering cutoff; opening the link flips it on the next reload. */
const newUser = (): FakeUser & { clickLink: () => void } => {
  let clicked = false;
  const user = {
    emailVerified: false,
    metadata: { creationTime: "Mon, 30 Nov 2026 10:00:00 GMT" },
    reload: async () => {
      user.emailVerified = clicked;
    },
    getIdToken: async () => "token",
    clickLink: () => {
      clicked = true;
    },
  };
  return user;
};

describe("ConfirmEmailProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.auth.currentUser = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.getElementById("modal-root")?.replaceChildren();
  });

  const render = () =>
    act(() =>
      root.render(
        <ConfirmEmailProvider>
          <Probe />
        </ConfirmEmailProvider>,
      ),
    );
  const modal = () => document.querySelector(".ConfirmEmail");

  it("doesn't open for a signed-out visitor: there's nothing to confirm", () => {
    render();
    act(() => ctx.showConfirmEmail());
    expect(modal()).toBeNull();
  });

  it("opens for a signed-in, unconfirmed account", () => {
    state.auth.currentUser = newUser();
    render();
    act(() => ctx.showConfirmEmail());
    expect(modal()).not.toBeNull();
  });

  it("notices a link opened in another tab when this one comes back", async () => {
    const user = newUser();
    state.auth.currentUser = user;
    render();
    expect(container.querySelector("#confirmed")!.textContent).toBe("false");

    user.clickLink();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(container.querySelector("#confirmed")!.textContent).toBe("true");
  });

  it("checks the account again, not the cached state, when asked to recheck", async () => {
    const user = newUser();
    // Cached as confirmed, but the account itself isn't (what the server goes by).
    user.emailVerified = true;
    state.auth.currentUser = user;
    render();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await ctx.ensureConfirmed();
    });
    expect(ok).toBe(true);
    expect(modal()).toBeNull();

    await act(async () => {
      ok = await ctx.ensureConfirmed({ recheck: true });
    });
    expect(ok).toBe(false);
    expect(modal()).not.toBeNull();
  });
});
