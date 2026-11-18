import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { onSnapshot } from "firebase/firestore";
import { DELETED_USER, profileName, ProfilesState, useProfiles } from "@/hooks/useProfiles";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(),
  where: vi.fn((_f: string, _op: string, ids: string[]) => ({ ids })),
  query: vi.fn((_c: unknown, w: { ids: string[] }) => ({ ids: w.ids })),
  onSnapshot: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Listener = { ids: string[]; next: (snap: unknown) => void };

let latest: ProfilesState;
const Probe = ({ ids }: { ids: string[] }) => {
  latest = useProfiles(ids);
  return null;
};

const snapshot = (ids: string[]) => ({
  docs: ids.map((id) => ({ id, data: () => ({ displayName: id.toUpperCase() }) })),
});

describe("useProfiles", () => {
  let container: HTMLDivElement;
  let root: Root;
  let listeners: Listener[];

  beforeEach(() => {
    listeners = [];
    vi.mocked(onSnapshot).mockImplementation(((q: { ids: string[] }, next: never) => {
      listeners.push({ ids: q.ids, next });
      return vi.fn();
    }) as never);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.clearAllMocks();
  });

  const render = (ids: string[]) => act(() => root.render(<Probe ids={ids} />));
  const answer = (found: string[]) =>
    act(() =>
      listeners.at(-1)!.next(snapshot(found.filter((id) => listeners.at(-1)!.ids.includes(id)))),
    );

  it('names nobody "deleted user" until the profiles have been looked up', () => {
    render(["mina", "gone"]);
    expect(latest.isLoading).toBe(true);
    expect(profileName(latest, "gone")).toBeUndefined();

    answer(["mina"]);
    expect(latest.isLoading).toBe(false);
    expect(profileName(latest, "mina")).toBe("MINA");
    expect(profileName(latest, "gone")).toBe(DELETED_USER);
  });

  it("keeps known names while a changed set of ids loads; only the new ones wait", () => {
    render(["mina"]);
    answer(["mina"]);

    render(["mina", "ola"]);
    expect(latest.isLoading).toBe(true);
    expect(profileName(latest, "mina")).toBe("MINA");
    expect(profileName(latest, "ola")).toBeUndefined();

    answer(["mina", "ola"]);
    expect(profileName(latest, "ola")).toBe("OLA");
  });

  it("isn't loading when asked for nobody", () => {
    render([]);
    expect(latest.isLoading).toBe(false);
    expect(listeners).toHaveLength(0);
  });
});
