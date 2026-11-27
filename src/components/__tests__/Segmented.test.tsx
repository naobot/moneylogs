import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { getByRole, queryByText } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import Segmented from "@/components/Segmented";
import Disclosure from "@/components/Disclosure";
import { DISCLOSURES_KEY } from "@/hooks/useDisclosure";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (ui: ReactNode) => act(() => root.render(<MemoryRouter>{ui}</MemoryRouter>));

const PERIODS = [
  { id: "week", label: "week" },
  { id: "month", label: "month" },
  { id: "year", label: "year" },
] as const;

describe("Segmented", () => {
  it("is a named group whose chosen option is pressed", () => {
    const onChange = vi.fn();
    render(<Segmented aria-label="Period" value="month" onChange={onChange} options={PERIODS} />);

    expect(getByRole(container, "group", { name: "Period" })).toBeInTheDocument();
    expect(getByRole(container, "button", { name: "month" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getByRole(container, "button", { name: "week" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    act(() => getByRole(container, "button", { name: "year" }).click());
    expect(onChange).toHaveBeenCalledWith("year");
  });

  it("doesn't report choosing what's already chosen", () => {
    const onChange = vi.fn();
    render(<Segmented aria-label="Period" value="month" onChange={onChange} options={PERIODS} />);
    act(() => getByRole(container, "button", { name: "month" }).click());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("links to pages, marking the current one", () => {
    render(
      <Segmented
        aria-label="View"
        value="stats"
        options={[
          { id: "entries", label: "entries", to: "/l/abc" },
          { id: "stats", label: "stats", to: "/l/abc/stats" },
        ]}
      />,
    );
    expect(getByRole(container, "link", { name: "stats" })).toHaveAttribute("aria-current", "page");
    expect(getByRole(container, "link", { name: "entries" })).not.toHaveAttribute("aria-current");
  });

  it("names glyph-like options by their aria label", () => {
    render(
      <Segmented
        aria-label="Text size"
        value="m"
        options={[
          { id: "s", label: "S", ariaLabel: "small" },
          { id: "m", label: "M", ariaLabel: "medium" },
        ]}
      />,
    );
    expect(getByRole(container, "button", { name: "medium" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("Disclosure", () => {
  it("starts folded and opens on a click", () => {
    render(
      <Disclosure title="breakdown" note="4 categories">
        <p>groceries · 38%</p>
      </Disclosure>,
    );
    const toggle = getByRole(container, "button", { name: /breakdown/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("[+] breakdown");
    expect(queryByText(container, "groceries · 38%")).toBeNull();

    act(() => toggle.click());
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("[-] breakdown");
    expect(queryByText(container, "groceries · 38%")).toBeInTheDocument();
  });

  it("remembers its open state on this device by id", () => {
    render(
      <Disclosure id="ledger-breakdown" title="breakdown">
        <p>groceries</p>
      </Disclosure>,
    );
    act(() => getByRole(container, "button", { name: /breakdown/ }).click());
    expect(JSON.parse(window.localStorage.getItem(DISCLOSURES_KEY)!)).toEqual({
      "ledger-breakdown": true,
    });

    // Shown again later: it comes back open.
    act(() => root.unmount());
    root = createRoot(container);
    render(
      <Disclosure id="ledger-breakdown" title="breakdown">
        <p>groceries</p>
      </Disclosure>,
    );
    expect(getByRole(container, "button", { name: /breakdown/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("lets a stored choice win over defaultOpen", () => {
    window.localStorage.setItem(DISCLOSURES_KEY, JSON.stringify({ "ledger-breakdown": false }));
    render(
      <Disclosure id="ledger-breakdown" title="breakdown" defaultOpen>
        <p>groceries</p>
      </Disclosure>,
    );
    expect(getByRole(container, "button", { name: /breakdown/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
