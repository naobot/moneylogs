import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { getByRole } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import TitleBar from "@/components/TitleBar";
import SectionLabel from "@/components/SectionLabel";

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

const render = (ui: ReactNode) => act(() => root.render(<MemoryRouter>{ui}</MemoryRouter>));

describe("TitleBar", () => {
  it("is the page's heading, with actions named by their words", () => {
    const onManage = vi.fn();
    render(
      <TitleBar title="household" meta="financial · 2 members">
        <TitleBar.Action label="manage" icon="gear" onClick={onManage} />
        <TitleBar.Action label="invite" icon="plus" to="/l/abc/invite" />
      </TitleBar>,
    );

    expect(getByRole(container, "heading", { level: 1, name: "household" })).toBeInTheDocument();
    const manage = getByRole(container, "button", { name: "manage" });
    expect(manage).toHaveAttribute("title", "manage");
    act(() => manage.click());
    expect(onManage).toHaveBeenCalledOnce();
    expect(getByRole(container, "link", { name: "invite" })).toHaveAttribute(
      "href",
      "/l/abc/invite",
    );
  });

  it("leaves out the actions label when there are none", () => {
    render(<TitleBar title="notifications" />);
    expect(container.querySelector(".TitleBar__actions")).toBeNull();
  });
});

describe("SectionLabel", () => {
  it("names the section with its count, and runs its action", () => {
    const onEdit = vi.fn();
    render(
      <SectionLabel
        count={3}
        aside={<SectionLabel.Action onClick={onEdit}>edit</SectionLabel.Action>}
      >
        new
      </SectionLabel>,
    );

    expect(getByRole(container, "heading", { level: 2 })).toHaveTextContent("new · 3");
    act(() => getByRole(container, "button", { name: "edit" }).click());
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("marks today's header as the black bar", () => {
    render(
      <SectionLabel variant="today" as="h3" aside="¥ 3,140">
        today · thu 26 nov
      </SectionLabel>,
    );
    expect(container.querySelector(".SectionLabel")).toHaveClass("SectionLabel--today");
    expect(getByRole(container, "heading", { level: 3 })).toHaveTextContent("today · thu 26 nov");
  });
});
