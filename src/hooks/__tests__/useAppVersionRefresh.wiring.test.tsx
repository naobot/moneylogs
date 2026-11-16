import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { AWAY_MS as AWAY, useAppVersionRefresh } from "@/hooks/useAppVersionRefresh";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: { updateAvailable: boolean } = { updateAvailable: false };
const Probe = () => {
  latest = useAppVersionRefresh();
  return null;
};

// Controllable stand-ins for the browser environment.
let servedBuildId = "old";
let now = 1_000;
let hidden = false;
let reload: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

const setHidden = (value: boolean) => {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("useAppVersionRefresh wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    servedBuildId = "old";
    now = 1_000;
    hidden = false;
    latest = { updateAvailable: false };

    vi.spyOn(Date, "now").mockImplementation(() => now);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ buildId: servedBuildId }),
    })) as unknown as typeof fetch;

    reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    delete (document as unknown as { hidden?: boolean }).hidden;
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  const mount = async () => {
    await act(async () => {
      root.render(<Probe />);
    });
    await act(async () => {}); // flush the boot version fetch
  };

  // Focus a text field, as a browser restores focus to it when the tab returns.
  const focusField = () => {
    const input = document.createElement("input");
    container.appendChild(input);
    input.focus();
  };

  it("reloads after returning past the away threshold", async () => {
    await mount();

    await act(async () => setHidden(true));
    now += AWAY;
    await act(async () => setHidden(false));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when returning too soon", async () => {
    await mount();

    await act(async () => setHidden(true));
    now += AWAY - 1_000;
    servedBuildId = "new";
    await act(async () => setHidden(false));
    await act(async () => {});

    expect(reload).not.toHaveBeenCalled();
    expect(latest.updateAvailable).toBe(false);
  });

  it("prompts instead of reloading when mid-edit and a new build is deployed", async () => {
    await mount();
    focusField();

    await act(async () => setHidden(true)); // tab hidden at now=1000
    now += AWAY + 1; // ...return 3h+ later
    servedBuildId = "new"; // ...to a new deploy
    await act(async () => setHidden(false));
    await act(async () => {}); // flush the version re-fetch

    expect(reload).not.toHaveBeenCalled();
    expect(latest.updateAvailable).toBe(true);
  });

  it("neither reloads nor prompts when mid-edit and the build is unchanged", async () => {
    await mount();
    focusField();

    await act(async () => setHidden(true));
    now += AWAY + 1;
    // servedBuildId stays "old"
    await act(async () => setHidden(false));
    await act(async () => {});

    expect(reload).not.toHaveBeenCalled();
    expect(latest.updateAvailable).toBe(false);
  });
});
