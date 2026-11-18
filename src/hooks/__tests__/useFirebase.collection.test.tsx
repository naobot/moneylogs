import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { onSnapshot, Query } from "firebase/firestore";
import { FirebaseQuery, useFirebaseCollection } from "@/hooks/useFirebase";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({ onSnapshot: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Listener = { key: string; next: (snap: unknown) => void; error: (err: unknown) => void };

let latest: FirebaseQuery<string>;
const Probe = ({ id, enabled = true }: { id: string; enabled?: boolean }) => {
  latest = useFirebaseCollection<string>({
    queryBuilder: () => ({ key: id }) as unknown as Query,
    dataTransformer: (docs) => docs.map((d) => d.id),
    dependencies: [id],
    enabled,
  });
  return null;
};

const snapshot = (ids: string[]) => ({ empty: !ids.length, docs: ids.map((id) => ({ id })) });

describe("useFirebaseCollection", () => {
  let container: HTMLDivElement;
  let root: Root;
  let listeners: Listener[];

  beforeEach(() => {
    listeners = [];
    vi.mocked(onSnapshot).mockImplementation(((q: { key: string }, next: never, error: never) => {
      listeners.push({ key: q.key, next, error });
      return vi.fn();
    }) as never);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.clearAllMocks();
  });

  const render = (props: { id: string; enabled?: boolean }) =>
    act(() => root.render(<Probe {...props} />));
  const deliver = (key: string, ids: string[]) =>
    act(() => listeners.filter((l) => l.key === key).forEach((l) => l.next(snapshot(ids))));

  it("reports loading, with no data, until the first snapshot (not an empty success)", () => {
    render({ id: "a" });
    expect(latest).toMatchObject({ isLoading: true, isSuccess: false, data: [] });

    deliver("a", []);
    expect(latest).toMatchObject({ isLoading: false, isSuccess: true, data: [] });
  });

  it("never shows the previous query's data when the dependencies change", () => {
    render({ id: "a" });
    deliver("a", ["a1"]);
    expect(latest.data).toEqual(["a1"]);

    render({ id: "b" });
    expect(latest).toMatchObject({ isLoading: true, isSuccess: false, data: [] });

    deliver("b", ["b1"]);
    expect(latest).toMatchObject({ isLoading: false, isSuccess: true, data: ["b1"] });
  });

  it("is idle when disabled, dropping anything it had", () => {
    render({ id: "a" });
    deliver("a", ["a1"]);

    render({ id: "a", enabled: false });
    expect(latest).toMatchObject({ isLoading: false, isSuccess: false, data: [] });
  });

  it("reports an error as an error, not as an empty success", () => {
    render({ id: "a" });
    act(() => listeners[0].error(new Error("denied")));
    expect(latest).toMatchObject({ isLoading: false, isSuccess: false, isError: true });
  });
});
