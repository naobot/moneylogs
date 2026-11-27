import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { getByRole } from "@testing-library/dom";
import Switch from "@/components/Switch";
import Check, { RadioRows } from "@/components/Check";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (ui: ReactNode) => act(() => root.render(ui));

describe("Switch", () => {
  it("is a switch named by its label and described by its hint", () => {
    const onChange = vi.fn();
    render(
      <Switch label="daily digest" hint="One email a day." checked={false} onChange={onChange} />,
    );
    const sw = getByRole(container, "switch", { name: "daily digest" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveAccessibleDescription("One email a day.");

    act(() => sw.click());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does nothing while disabled", () => {
    const onChange = vi.fn();
    render(<Switch label="fixed cost" checked disabled onChange={onChange} />);
    const sw = getByRole(container, "switch", { name: "fixed cost" });
    expect(sw).toBeDisabled();
    act(() => sw.click());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Check", () => {
  it("is a real checkbox named by its row, with the text-mode mark hidden", () => {
    const onChange = vi.fn();
    render(
      <Check checked={false} onChange={onChange}>
        12 nov · coffee
      </Check>,
    );
    const box = getByRole(container, "checkbox", { name: "12 nov · coffee" });
    expect(box).not.toBeChecked();
    expect(container.querySelector(".Check__mark")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".Check__mark")).toHaveTextContent("[ ]");

    act(() => box.click());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows [x] when checked", () => {
    render(
      <Check checked onChange={() => {}}>
        groceries
      </Check>,
    );
    expect(container.querySelector(".Check__mark")).toHaveTextContent("[x]");
  });
});

describe("RadioRows", () => {
  const OPTIONS = [
    { id: "lot", label: "save a lot", description: "Tight budgets." },
    { id: "steady", label: "save steadily" },
  ] as const;

  it("is a named radio group whose chosen answer is checked and marked (•)", () => {
    const onChange = vi.fn();
    render(
      <RadioRows
        name="saving"
        aria-label="Saving"
        options={OPTIONS}
        value="steady"
        onChange={onChange}
      />,
    );
    expect(getByRole(container, "radiogroup", { name: "Saving" })).toBeInTheDocument();
    const steady = getByRole(container, "radio", { name: "save steadily" });
    expect(steady).toBeChecked();
    expect(steady.closest("label")).toHaveClass("RadioRows__row--chosen");
    expect(steady.closest("label")!.querySelector(".Check__mark")).toHaveTextContent("(•)");

    act(() => getByRole(container, "radio", { name: /save a lot/ }).click());
    expect(onChange).toHaveBeenCalledWith("lot");
  });

  it("starts with nothing chosen when there's no value", () => {
    render(
      <RadioRows
        name="saving"
        aria-label="Saving"
        options={OPTIONS}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(container.querySelectorAll("input:checked")).toHaveLength(0);
    expect(container.querySelectorAll(".RadioRows__row--chosen")).toHaveLength(0);
  });
});
