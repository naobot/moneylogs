import { describe, it, expect, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Icon, { IconType } from "@/components/Icon";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Asset paths under public/, e.g. "/public/icons/nakals-trash.svg".
const ASSETS = Object.keys(import.meta.glob("/public/icons/*.svg"));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const srcOf = (type: IconType) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Icon type={type} />));
  return container.querySelector("img")!.getAttribute("src")!;
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe("Icon", () => {
  it.each<[IconType, string]>([
    ["gear", "/icons/moneylogs-gear.svg"],
    ["pencil", "/icons/kanyayee-pencil.svg"],
    ["trash", "/icons/nakals-trash.svg"],
  ])("resolves %s to its asset, which exists", (type, src) => {
    expect(srcOf(type)).toBe(src);
    expect(ASSETS).toContain(`/public${src}`);
  });
});
