import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const stamp = vi.fn(async () => {});
let currentUser: { id: string; logLastViewedAt?: Record<string, unknown> } | undefined;

vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user: currentUser }) }));
vi.mock("@/hooks/useUserQuery", () => ({ useUserQuery: () => ({ stampLogVisitFn: stamp }) }));

import { useStampLogVisit } from "@/hooks/useStampLogVisit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Probe = ({ logId }: { logId?: string }) => {
  useStampLogVisit(logId);
  return null;
};

describe("useStampLogVisit", () => {
  let container: HTMLDivElement;
  let root: Root;
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    stamp.mockClear();
    currentUser = { id: "doc-1" };
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  const render = (logId?: string) => act(() => root.render(<Probe logId={logId} />));

  it("does nothing without a log id (spectator / still loading)", () => {
    render(undefined);
    expect(stamp).not.toHaveBeenCalled();
  });

  it("stamps on open when never visited", () => {
    render("g1");
    expect(stamp).toHaveBeenCalledWith({ userId: "doc-1", logId: "g1" });
  });

  it("doesn't restamp on open within two minutes of the stored marker", () => {
    currentUser = { id: "doc-1", logLastViewedAt: { g1: { seconds: (NOW - 60_000) / 1000 } } };
    render("g1");
    expect(stamp).not.toHaveBeenCalled();
  });

  it("stamps again on leaving after a real visit, but not after a quick bounce", () => {
    render("g1");
    expect(stamp).toHaveBeenCalledTimes(1);

    // Quick bounce: leave 2s later — skipped.
    vi.setSystemTime(NOW + 2_000);
    render(undefined);
    expect(stamp).toHaveBeenCalledTimes(1);

    // Come back within the open throttle — no write; stay a minute, then leave — written.
    vi.setSystemTime(NOW + 5_000);
    render("g1");
    expect(stamp).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW + 65_000);
    render(undefined);
    expect(stamp).toHaveBeenCalledTimes(2);
  });

  it("never writes over a stamp still in flight", () => {
    currentUser = { id: "doc-1", logLastViewedAt: { g1: null } };
    render("g1");
    expect(stamp).not.toHaveBeenCalled();
  });
});
