import { describe, it, expect, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import KnickKnack from "../KnickKnack";

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

describe("KnickKnack", () => {
  it("draws the art in the current ink, labelled with its name", () => {
    render(<KnickKnack id="maple_leaf" size={32} />);
    const svg = host.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("maple leaf");
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.querySelector("path")!.getAttribute("d")).toMatch(/^M\d+ \d+h/);
  });
});
