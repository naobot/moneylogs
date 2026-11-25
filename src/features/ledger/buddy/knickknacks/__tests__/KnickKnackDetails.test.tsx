import { describe, it, expect, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import KnickKnackDetails from "../KnickKnackDetails";
import { KNICK_KNACKS, RARITY_LABELS } from "../catalog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;

const render = (ui: React.ReactNode) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(ui));
};

afterEach(() => {
  act(() => root?.unmount());
  host.remove();
  root = null;
});

const modal = () => document.querySelector(".KnickKnackDetails")!;
const buttons = () =>
  Array.from(modal().querySelectorAll<HTMLButtonElement>(".Modal__footer button"));

describe("KnickKnackDetails", () => {
  it("shows the art large, the name, the rarity and the buddy's line", () => {
    render(<KnickKnackDetails item="apple" onClose={() => {}} />);
    expect(modal().querySelector(".Modal__title")!.textContent).toBe("apple");
    expect(modal().querySelector("svg")!.getAttribute("width")).toBe("128");
    const rarity = modal().querySelector(".KnickKnackDetails__rarity")!;
    expect(rarity.textContent).toBe("rarity: rare");
    expect(rarity.classList.contains("KnickKnackDetails__rarity--rare")).toBe(true);
    expect(modal().querySelector(".KnickKnackDetails__found")!.textContent).toBe(
      `“${KNICK_KNACKS.apple.found}”`,
    );
    expect(modal().querySelector(".KnickKnackDetails__note")).toBeNull();
  });

  it("calls super-common items everyday", () => {
    expect(RARITY_LABELS.super_common).toBe("everyday");
  });

  it("shows a note, and a give button only when there's a way to give", () => {
    const onGive = vi.fn();
    const onClose = vi.fn();
    render(<KnickKnackDetails item="acorn" note="found 3 nov" onClose={onClose} />);
    expect(modal().querySelector(".KnickKnackDetails__note")!.textContent).toBe("found 3 nov");
    expect(buttons().map((b) => b.textContent!.toLowerCase())).toEqual(["close"]);
    act(() => buttons()[0].click());
    expect(onClose).toHaveBeenCalled();

    act(() => root!.render(<KnickKnackDetails item="acorn" onGive={onGive} onClose={onClose} />));
    const give = buttons().find((b) => /give one/i.test(b.textContent ?? ""))!;
    act(() => give.click());
    expect(onGive).toHaveBeenCalled();
  });
});
