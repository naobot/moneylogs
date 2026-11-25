import { describe, it, expect } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import { LogCard } from "../LogCard";
import { useVisualHarness } from "@/test/visual";
import "../Dashboard.scss";

// Home's log cards as the dashboard lays them out: large cards (one with new activity,
// one parent with a sublog hung under it) and the small grid of past logs.
describe("dashboard log cards (visual)", () => {
  const v = useVisualHarness();

  it("renders the cards at every text and UI size", async () => {
    v.render(
      <MemoryRouter>
        <div className="Dashboard">
          <div className="Dashboard__grid Dashboard__grid--large">
            <LogCard
              to="/g/g1"
              title="Kyoto trip"
              size="large"
              kind="log group"
              details={["ongoing · ends in 3 days", "4 members"]}
              badge="3 new posts"
            />
            <div className="Dashboard__family">
              <LogCard
                to="/l/l1"
                title="household"
                size="large"
                kind="financial · shared"
                details={["¥182,400 this month", "2 members", "incl. 1 sublog"]}
              />
              <ul className="Dashboard__family__kids" aria-label="household's sublogs">
                <li className="Dashboard__family__kid">
                  <LogCard
                    to="/l/l2"
                    title="groceries for the flat"
                    size="small"
                    kind="sublog"
                    details={["¥41,900 this month"]}
                  />
                </li>
              </ul>
            </div>
          </div>
          <div className="Dashboard__grid">
            <LogCard to="/g/g2" title="Lisbon" size="compact" kind="log group" />
            <LogCard to="/g/g3" title="Seoul spring weekend" size="compact" kind="log group" />
            <LogCard to="/l/l3" title="wedding" size="compact" kind="financial" />
          </div>
        </div>
      </MemoryRouter>,
    );

    expect(v.container.querySelectorAll("a")).toHaveLength(6);
    await v.sizes("dashboard log cards");
  });
});
