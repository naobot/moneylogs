import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useAppVersionRefresh } from "@/hooks/useAppVersionRefresh";

const AWAY = 4 * 60 * 60 * 1000;

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

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    delete (document as unknown as { hidden?: boolean }).hidden;
  });

  const mount = async () => {
    await act(async () => {
      root.render(<Probe />);
    });
    await act(async () => {}); // flush the boot version fetch
  };

  it("prompts after returning past the away threshold to a new build", async () => {
    await mount();

    await act(async () => setHidden(true)); // tab hidden at now=1000
    now += AWAY + 1; // ...return 4h+ later
    servedBuildId = "new"; // ...to a new deploy
    await act(async () => setHidden(false));
    await act(async () => {}); // flush the version re-fetch

    expect(latest.updateAvailable).toBe(true);
  });

  it("does not prompt when returning too soon", async () => {
    await mount();

    await act(async () => setHidden(true));
    now += AWAY - 1_000; // just under the threshold
    servedBuildId = "new";
    await act(async () => setHidden(false));
    await act(async () => {});

    expect(latest.updateAvailable).toBe(false);
  });

  it("does not prompt when the build is unchanged", async () => {
    await mount();

    await act(async () => setHidden(true));
    now += AWAY + 1;
    // servedBuildId stays "old"
    await act(async () => setHidden(false));
    await act(async () => {});

    expect(latest.updateAvailable).toBe(false);
  });
});
