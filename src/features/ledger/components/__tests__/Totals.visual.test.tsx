import { describe, it, expect } from "vite-plus/test";
import Totals from "../Totals";
import { useVisualHarness } from "@/test/visual";
import "../Ledger.scss";

describe("Totals (visual)", () => {
  const v = useVisualHarness();

  it("renders one currency inline and several as a stacked column", async () => {
    v.render(
      <>
        <Totals totals={{ JPY: 42100 }} />
        <Totals totals={{ JPY: 42100, CAD: 128.5, EUR: 19.99 }} />
      </>,
    );

    expect(v.container.querySelector(".Totals--multi")).not.toBeNull();
    await v.sizes("single and multi-currency totals");
  });
});
