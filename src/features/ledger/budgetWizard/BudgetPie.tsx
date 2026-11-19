import { PIXEL_TILES, rimPoint, slicePath } from "@/utils/pie";
import { PLAN_GROUPS, PlanGroup, pieSlices, PieDatum } from "./budgetPlan";

import "./BudgetPie.scss";

/**
 * The plan as a pie: one slice per category (paper gaps between them), filled by
 * group so only four fills need telling apart, two inks only. The list beside it
 * carries the names and figures, so the pie stays unlabelled; a legend names the groups.
 */

// Rendered at its viewBox size, so the 1-bit patterns land on whole pixels.
const SIZE = 160;
const C = SIZE / 2;
const R = C - 2;

const point = (angle: number) =>
  rimPoint(angle, C, R)
    .map((n) => n.toFixed(2))
    .join(" ");

/** The same pixel tiles as src/texture.scss, as SVG patterns in the current ink. */
const PATTERNS = { dither: PIXEL_TILES.dither, hatch: PIXEL_TILES.hatch };

/** The swatch beside a list row or legend entry: a tiny framed piece of its fill. */
const GROUP_SWATCH: Record<PlanGroup, string> = {
  fixed: "BudgetPie__swatch--fixed",
  essentials: "tex-dither",
  lifestyle: "tex-hatch",
  savings: "BudgetPie__swatch--savings",
};

export const Swatch = ({ group }: { group: PlanGroup }) => (
  <span className={`BudgetPie__swatch ${GROUP_SWATCH[group]}`} aria-hidden="true" />
);

export const BudgetPie = ({
  data,
  summary,
}: {
  data: ReadonlyArray<PieDatum>;
  summary: string;
}) => {
  const slices = pieSlices(data);
  return (
    <div className="BudgetPie">
      <svg
        className="BudgetPie__chart"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={summary}
        shapeRendering="geometricPrecision"
      >
        <defs>
          {Object.entries(PATTERNS).map(([name, { size, cells }]) => (
            <pattern
              key={name}
              id={`BudgetPie-${name}`}
              width={size}
              height={size}
              patternUnits="userSpaceOnUse"
            >
              {/* Fills come from CSS (BudgetPie.scss), so they follow Night shift. */}
              <rect className="BudgetPie__paper" width={size} height={size} />
              {cells.map(([x, y]) => (
                <rect
                  key={`${x}-${y}`}
                  className="BudgetPie__ink"
                  x={x}
                  y={y}
                  width={1}
                  height={1}
                  shapeRendering="crispEdges"
                />
              ))}
            </pattern>
          ))}
        </defs>
        {slices.map((slice) => (
          <path
            key={slice.id}
            className={`BudgetPie__slice BudgetPie__slice--${slice.group}`}
            d={slicePath(slice, C, R)}
          >
            <title>{`${slice.name}: ${slice.label}`}</title>
          </path>
        ))}
        {/* Paper gaps along each boundary only, so the rim stays one clean line: thin
            within a group, wider between groups. */}
        {slices.length > 1 &&
          slices.map((slice, i) => {
            const before = slices[(i - 1 + slices.length) % slices.length];
            return (
              <path
                key={`gap-${slice.id}`}
                className={`BudgetPie__gap${before.group === slice.group ? " BudgetPie__gap--inGroup" : ""}`}
                d={`M${C} ${C}L${point(slice.start)}`}
              />
            );
          })}
        <circle className="BudgetPie__rim" cx={C} cy={C} r={R} />
      </svg>
      <ul className="BudgetPie__legend" aria-label="Chart key">
        {PLAN_GROUPS.map((g) => (
          <li key={g.id}>
            <Swatch group={g.id} />
            {g.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BudgetPie;
