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

const modal = () => document.querySelector<HTMLElement>(".KnickKnackDetails")!;
const buttons = () => Array.from(modal().querySelectorAll<HTMLButtonElement>("button"));

describe("KnickKnackDetails", () => {
  it("shows the art large, the name, the rarity and the buddy's line, with no title bar", () => {
    render(<KnickKnackDetails item="apple" onClose={() => {}} />);
    expect(modal().querySelector(".Modal__header")).toBeNull();
    const dialog = modal().querySelector('[role="dialog"]')!;
    const title = document.getElementById(dialog.getAttribute("aria-labelledby")!)!;
    expect(title.textContent).toBe("apple");
    expect(modal().querySelector("svg")!.getAttribute("width")).toBe("128");
    const rarity = modal().querySelector(".KnickKnackDetails__rarity")!;
    expect(rarity.textContent).toBe("rarity: rare");
    expect(rarity.classList.contains("KnickKnackDetails__rarity--rare")).toBe(true);
    expect(modal().querySelector(".KnickKnackDetails__found")!.textContent).toBe(
      `“${KNICK_KNACKS.apple.found}”`,
    );
    // Clicking away closes it: no close button.
    expect(buttons()).toHaveLength(0);
  });

  it("shows how many after the name, only when more than one", () => {
    render(<KnickKnackDetails item="acorn" count={1} onClose={() => {}} />);
    expect(modal().querySelector("h2")!.textContent).toBe("acorn");
    act(() => root!.render(<KnickKnackDetails item="acorn" count={3} onClose={() => {}} />));
    expect(modal().querySelector("h2")!.textContent).toBe("acorn ×3");
  });

  it("names rarities everyday, uncommon, rare, unique and special", () => {
    expect(RARITY_LABELS).toEqual({
      super_common: "everyday",
      common: "uncommon",
      rare: "rare",
      milestone: "unique",
      special: "special",
    });
  });

  it("closes on a click away", () => {
    const onClose = vi.fn();
    render(<KnickKnackDetails item="acorn" onClose={onClose} />);
    act(() => modal().click());
    expect(onClose).not.toHaveBeenCalled();
    act(() => document.querySelector<HTMLElement>(".Modal__backdrop")!.click());
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a give button only when there's a way to give", () => {
    const onGive = vi.fn();
    render(<KnickKnackDetails item="acorn" onGive={onGive} onClose={() => {}} />);
    act(() => buttons()[0].click());
    expect(onGive).toHaveBeenCalled();
  });
});

describe("find lines", () => {
  it("start each sentence with a capital", () => {
    for (const { found } of Object.values(KNICK_KNACKS)) {
      expect(found[0]).toBe(found[0].toUpperCase());
      // Sentence ends (". ", "! ", "? ") are followed by a capital, and "i" is "I".
      expect(found).not.toMatch(/[.!?] [a-z]/);
      expect(found).not.toMatch(/\bi\b|\bi'/);
    }
  });
});
