import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const sendNudge = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("../nudgeStore", () => ({ sendNudge }));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "me", userId: "meUid" } }),
}));
vi.mock("@/utils/analytics", () => ({ track: vi.fn() }));

import { POKE_DEBOUNCE_MS, useSendNudge } from "../useSendNudge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const parties = { from: "me", fromUid: "meUid", to: "pal", toUid: "palUid" };

describe("useSendNudge", () => {
  let container: HTMLDivElement;
  let root: Root;
  let api: ReturnType<typeof useSendNudge>;

  const Probe = ({ toUid = "palUid" }: { toUid?: string | null }) => {
    api = useSendNudge("pal", toUid);
    return <span>{api.sent}</span>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sendNudge.mockClear();
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(<Probe />));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("sends a flurry of pokes as one write", () => {
    act(() => {
      for (let i = 0; i < 5; i++) api.poke();
    });
    expect(sendNudge).not.toHaveBeenCalled();
    expect(container.textContent).toBe("5");
    act(() => {
      vi.advanceTimersByTime(POKE_DEBOUNCE_MS);
    });
    expect(sendNudge).toHaveBeenCalledTimes(1);
    expect(sendNudge).toHaveBeenCalledWith(parties, { pokes: 5, cheer: undefined });
  });

  it("sends waiting pokes along with a cheer, straight away", () => {
    act(() => {
      api.poke();
      api.poke();
      void api.cheer("proud");
    });
    expect(sendNudge).toHaveBeenCalledWith(parties, { pokes: 2, cheer: "proud" });
    act(() => {
      vi.advanceTimersByTime(POKE_DEBOUNCE_MS);
    });
    expect(sendNudge).toHaveBeenCalledTimes(1);
  });

  it("doesn't lose pokes when it goes away mid-flurry", () => {
    act(() => api.poke());
    act(() => root.unmount());
    expect(sendNudge).toHaveBeenCalledWith(parties, { pokes: 1, cheer: undefined });
    root = createRoot(container); // for afterEach
  });

  it("does nothing without the friend's uid", () => {
    act(() => root.render(<Probe toUid={null} />));
    expect(api.canSend).toBe(false);
    act(() => api.poke());
    act(() => {
      vi.advanceTimersByTime(POKE_DEBOUNCE_MS);
    });
    expect(sendNudge).not.toHaveBeenCalled();
  });
});
