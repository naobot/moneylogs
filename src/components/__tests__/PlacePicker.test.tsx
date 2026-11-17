import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

vi.mock("@/hooks/usePlaceIndex", async () => {
  const { buildPlaceIndex } = await import("@/utils/citySearch");
  const index = buildPlaceIndex(
    {
      v: 1,
      tz: ["Asia/Tokyo", "America/Chicago", "America/New_York"],
      regions: ["Kyoto", "Illinois", "Massachusetts"],
      countries: { JP: "Japan", US: "United States" },
      rows: [
        ["Kyoto", "JP", 0, 0],
        ["Springfield", "US", 1, 1],
        ["Springfield", "US", 2, 2],
      ],
    },
    ["UTC"],
  );
  return { usePlaceIndex: () => ({ status: "ready", index }) };
});

import PlacePicker from "@/components/PlacePicker";
import { Place } from "@/utils/citySearch";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PlacePicker", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn<(place: Place) => void>();

  const render = (props: { timezone?: string; place?: string } = {}) =>
    act(() =>
      root.render(
        <PlacePicker
          label="I'm based in"
          timezone={props.timezone}
          place={props.place}
          onChange={onChange}
        />,
      ),
    );

  beforeEach(() => {
    onChange.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const input = () => container.querySelector<HTMLInputElement>("input[role=combobox]")!;
  const options = () =>
    Array.from(container.querySelectorAll("[role=option]")).map(
      (el) => el.querySelector(".PlacePicker__optionName")?.textContent,
    );
  const type = (value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input(), value);
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const key = (k: string) =>
    act(() => {
      input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    });

  it("shows the chosen place, and warns while nothing is chosen", () => {
    render();
    expect(container.querySelector(".ControlledInput--warning")).not.toBeNull();
    render({ timezone: "Asia/Tokyo", place: "Kyoto, Japan" });
    expect(input().value).toBe("Kyoto, Japan");
    expect(container.querySelector(".ControlledInput--warning")).toBeNull();
    expect(container.querySelector(".PlacePicker__zone")?.textContent).toMatch(
      /Asia\/Tokyo · GMT\+9 · .* there now/,
    );
  });

  it("falls back to the zone id when there's no place", () => {
    render({ timezone: "UTC" });
    expect(input().value).toBe("UTC");
  });

  it("lists matches as you type, with region details to tell them apart", () => {
    render();
    type("spring");
    expect(options()).toEqual(["Springfield, United States", "Springfield, United States"]);
    const details = Array.from(container.querySelectorAll(".PlacePicker__optionDetail")).map(
      (el) => el.textContent,
    );
    expect(details).toEqual(["Illinois, United States", "Massachusetts, United States"]);
  });

  it("picks with the keyboard", () => {
    render();
    type("spring");
    key("ArrowDown");
    key("Enter");
    expect(onChange).toHaveBeenCalledWith({
      kind: "city",
      name: "Springfield",
      region: "Massachusetts",
      country: "United States",
      timezone: "America/New_York",
    });
    expect(container.querySelector("[role=listbox]")).toBeNull();
  });

  it("wraps around with the arrow keys", () => {
    render();
    type("spring");
    key("ArrowUp");
    key("Enter");
    expect(onChange.mock.calls[0][0]).toMatchObject({ region: "Massachusetts" });
  });

  it("puts the chosen place back on Escape", () => {
    render({ timezone: "Asia/Tokyo", place: "Kyoto, Japan" });
    type("spri");
    key("Escape");
    expect(input().value).toBe("Kyoto, Japan");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says so when nothing matches", () => {
    render();
    type("atlantis");
    expect(options()).toEqual([]);
    expect(container.querySelector(".PlacePicker__status")?.textContent).toMatch(/no matches/);
  });

  it("finds bare zones too", () => {
    render();
    type("utc");
    key("Enter");
    expect(onChange).toHaveBeenCalledWith({ kind: "zone", name: "UTC", timezone: "UTC" });
  });
});
