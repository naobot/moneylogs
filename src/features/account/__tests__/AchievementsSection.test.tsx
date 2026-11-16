import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/config/firebase-config", () => ({ db: {} }));

import { AchievementsSection } from "@/features/account/AchievementsSection";
import type { Achievement, MilestoneAchievement } from "@/hooks/useAchievements";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AchievementsSection", () => {
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

  it("shows a milestone achievement with its knick-knack's large art, not as a link", () => {
    const coin = { id: "coin__gold_coin", type: "gold_coin" } as MilestoneAchievement;
    const group = {
      id: "g1__time_traveller",
      type: "time_traveller",
      groupId: "g1",
      groupTitle: "Lisbon",
    } as Achievement;
    act(() =>
      root.render(
        <MemoryRouter>
          <AchievementsSection achievements={[coin, group]} />
        </MemoryRouter>,
      ),
    );

    const tile = container.querySelector(".AchievementsList__item--milestone")!;
    expect(tile.tagName).toBe("DIV");
    expect(tile.textContent).toContain("A Whole Month");
    const art = tile.querySelector("svg.KnickKnack")!;
    expect(art.getAttribute("aria-label")).toBe("gold coin");
    expect(art.getAttribute("width")).toBe("64");

    const link = container.querySelector("a.AchievementsList__item")!;
    expect(link.getAttribute("href")).toBe("/g/g1");
  });
});
