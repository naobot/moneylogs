import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { getByRole, queryByText } from "@testing-library/dom";
import Field from "@/components/Field";
import TextArea from "@/components/TextArea";
import Select, { InlineSelect } from "@/components/Select";
import Amount from "@/components/Amount";

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

/** React listens for the native input event; set the value the way the browser does. */
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(() => {
    const proto = Object.getPrototypeOf(el) as object;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

describe("Field", () => {
  it("is named by its visible label and described by its hint", () => {
    render(<Field label="log name" hint="you can change it later" value="" onChange={() => {}} />);
    const input = getByRole(container, "textbox", { name: "log name" });
    expect(input).toHaveAccessibleDescription("you can change it later");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("says what's wrong instead of the hint, and marks itself invalid", () => {
    render(
      <Field
        label="log name"
        hint="you can change it later"
        error="give the log a name"
        value=""
        onChange={() => {}}
      />,
    );
    const input = getByRole(container, "textbox", { name: "log name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("give the log a name");
    expect(queryByText(container, "you can change it later")).toBeNull();
    expect(container.querySelector(".Field")).toHaveClass("Field--invalid");
  });

  it("draws a date as a chosen (solid) box", () => {
    render(<Field label="starts" type="date" value="2026-11-26" onChange={() => {}} />);
    expect(container.querySelector(".Field__box")).toHaveClass("Field__box--chosen");
  });

  it("passes typing through", () => {
    const onChange = vi.fn();
    render(<Field label="log name" value="" onChange={onChange} />);
    type(getByRole(container, "textbox", { name: "log name" }) as HTMLInputElement, "tokyo");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("TextArea", () => {
  it("says markdown is ok and counts against the limit", () => {
    render(<TextArea label="post" value="hello" onChange={() => {}} markdown maxLength={2000} />);
    expect(getByRole(container, "textbox", { name: "post" })).toHaveAttribute("maxlength", "2000");
    expect(container.querySelector(".Field__footer")).toHaveTextContent("markdown ok");
    expect(container.querySelector(".Field__count")).toHaveTextContent("5 / 2000");
  });

  it("only counts near the limit when asked to", () => {
    render(
      <TextArea
        label="comment"
        value="short"
        onChange={() => {}}
        maxLength={400}
        counter="near-limit"
      />,
    );
    expect(container.querySelector(".Field__count")).toBeNull();
    render(
      <TextArea
        label="comment"
        value={"x".repeat(320)}
        onChange={() => {}}
        maxLength={400}
        counter="near-limit"
      />,
    );
    expect(container.querySelector(".Field__count")).toHaveTextContent("320 / 400");
  });

  it("marks the count when it's full", () => {
    render(<TextArea label="comment" value={"x".repeat(10)} onChange={() => {}} maxLength={10} />);
    expect(container.querySelector(".Field__count")).toHaveClass("Field__count--full");
  });
});

describe("Select", () => {
  const OPTIONS = [
    { value: "groceries", label: "groceries" },
    { value: "dining", label: "dining out" },
  ];

  it("is a real select named by its label, reporting the chosen value", () => {
    const onChange = vi.fn();
    render(<Select label="category" value="groceries" onChange={onChange} options={OPTIONS} />);
    const select = getByRole(container, "combobox", { name: "category" }) as HTMLSelectElement;
    expect(select.value).toBe("groceries");
    act(() => {
      select.value = "dining";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("dining");
  });

  it("shows its prompt, muted, until something is chosen", () => {
    render(
      <Select
        label="category"
        value=""
        onChange={() => {}}
        options={OPTIONS}
        placeholder="pick a category…"
      />,
    );
    const select = getByRole(container, "combobox", { name: "category" }) as HTMLSelectElement;
    expect(select.selectedOptions[0]).toHaveTextContent("pick a category…");
    expect(container.querySelector(".Select")).toHaveClass("Select--empty");
  });

  it("names an inline select by its aria-label", () => {
    render(
      <InlineSelect
        aria-label="Currency"
        value="JPY"
        onChange={() => {}}
        options={[{ value: "JPY", label: "JPY" }]}
      />,
    );
    expect(getByRole(container, "combobox", { name: "Currency" })).toBeInTheDocument();
  });
});

describe("Amount", () => {
  it("is a decimal field named by its label, with a fixed currency cell", () => {
    render(<Amount label="amount" value="2180" onChange={() => {}} currency="JPY" />);
    const input = getByRole(container, "textbox", { name: "amount" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(container.querySelector(".Amount__currency")).toHaveTextContent("JPY");
    expect(container.querySelector("select")).toBeNull();
  });

  it("lets the currency be picked when it can change", () => {
    const onCurrency = vi.fn();
    render(
      <Amount
        label="amount"
        value=""
        onChange={() => {}}
        currency="JPY"
        onCurrencyChange={onCurrency}
      />,
    );
    const select = getByRole(container, "combobox", { name: "Currency" }) as HTMLSelectElement;
    act(() => {
      select.value = "CAD";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onCurrency).toHaveBeenCalledWith("CAD");
  });
});
