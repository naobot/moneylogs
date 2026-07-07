import { useMemo, useRef, useState } from "react";
import cx from "classnames";
import { Currency } from "@/types/user";
import { SpendingPoint } from "./spendingSeries";

type ChartMode = "bars" | "cumulative";

interface SpendingChartProps {
  series: SpendingPoint[];
  mode: ChartMode;
  currency: Currency;
  onSelectPoint?: (point: SpendingPoint) => void;
  selectedKey?: string | null;
}

// Fixed viewBox; CSS scales the SVG responsively (uniform, so strokes stay crisp).
const VW = 640;
const VH = 240;
const PAD = { top: 16, right: 10, bottom: 28, left: 10 };
const PLOT_W = VW - PAD.left - PAD.right;
const PLOT_H = VH - PAD.top - PAD.bottom;
const BASELINE = PAD.top + PLOT_H;

const fmt = (value: number, currency: Currency) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;

// A bar with only its top two corners rounded, anchored to the baseline.
const topRoundedBar = (x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  if (radius === 0) return `M${x},${y} h${w} v${h} h${-w} Z`;
  return [
    `M${x},${y + radius}`,
    `a${radius},${radius} 0 0 1 ${radius},${-radius}`,
    `h${w - 2 * radius}`,
    `a${radius},${radius} 0 0 1 ${radius},${radius}`,
    `v${h - radius}`,
    `h${-w}`,
    `Z`,
  ].join(" ");
};

const SpendingChart = ({
  series,
  mode,
  currency,
  onSelectPoint,
  selectedKey,
}: SpendingChartProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const n = series.length;
  const band = n > 0 ? PLOT_W / n : PLOT_W;
  const gap = n > 40 ? 1 : 2;
  const barWidth = Math.max(1, band - gap);

  const yMax = useMemo(() => {
    const values = series.map((p) => (mode === "cumulative" ? p.cumulative : p.amount));
    return Math.max(1, ...values);
  }, [series, mode]);

  const xCenter = (i: number) => PAD.left + band * i + band / 2;
  const yOf = (v: number) => PAD.top + PLOT_H * (1 - v / yMax);

  const linePath = useMemo(() => {
    if (mode !== "cumulative" || n === 0) return "";
    return series
      .map((p, i) => `${i === 0 ? "M" : "L"}${xCenter(i)},${yOf(p.cumulative)}`)
      .join(" ");
  }, [series, mode, n, yMax]);

  const areaPath = useMemo(() => {
    if (mode !== "cumulative" || n === 0) return "";
    const top = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${xCenter(i)},${yOf(p.cumulative)}`)
      .join(" ");
    return `${top} L${xCenter(n - 1)},${BASELINE} L${xCenter(0)},${BASELINE} Z`;
  }, [series, mode, n, yMax]);

  const updateTooltip = (index: number, evt: React.MouseEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    setHover(index);
    if (rect) setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top });
  };

  // Axis labels: first, middle, last bucket.
  const labelIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  const hovered = hover != null ? series[hover] : null;
  const summary =
    mode === "cumulative"
      ? `Cumulative ${currency} spending over time. Ends at ${fmt(series[n - 1]?.cumulative ?? 0, currency)}.`
      : `${currency} spending per period. Highest period ${fmt(yMax, currency)}.`;

  return (
    <div className="SpendingChart" ref={wrapperRef}>
      <svg
        className="SpendingChart__svg"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={summary}
      >
        {/* recessive top gridline at the max value */}
        <line
          className="SpendingChart__grid"
          x1={PAD.left}
          y1={yOf(yMax)}
          x2={VW - PAD.right}
          y2={yOf(yMax)}
        />
        <text className="SpendingChart__ytick" x={PAD.left} y={yOf(yMax) - 4}>
          {fmt(yMax, currency)}
        </text>

        {mode === "cumulative" && (
          <>
            <path className="SpendingChart__area" d={areaPath} />
            <path className="SpendingChart__line" d={linePath} />
          </>
        )}

        {mode === "bars" &&
          series.map((p, i) => {
            const h = BASELINE - yOf(p.amount);
            const isSelected = selectedKey != null && p.key === selectedKey;
            return (
              <path
                key={p.key}
                className={cx("SpendingChart__bar", {
                  "SpendingChart__bar--hover": hover === i,
                  "SpendingChart__bar--dim": selectedKey != null && !isSelected,
                })}
                d={topRoundedBar(PAD.left + band * i + gap / 2, yOf(p.amount), barWidth, h, 4)}
              />
            );
          })}

        {/* hovered/selected marker for the cumulative line */}
        {mode === "cumulative" && hovered && hover != null && (
          <circle
            className="SpendingChart__dot"
            cx={xCenter(hover)}
            cy={yOf(hovered.cumulative)}
            r={4}
          />
        )}

        {/* baseline */}
        <line
          className="SpendingChart__axis"
          x1={PAD.left}
          y1={BASELINE}
          x2={VW - PAD.right}
          y2={BASELINE}
        />

        {/* x labels */}
        {labelIdx.map((i) => (
          <text
            key={`xl-${i}`}
            className="SpendingChart__xtick"
            x={xCenter(i)}
            y={BASELINE + 16}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          >
            {series[i]?.date.format("D MMM")}
          </text>
        ))}

        {/* full-height hit targets, one per bucket (bigger than the mark) */}
        {series.map((p, i) => (
          <rect
            key={`hit-${p.key}`}
            className="SpendingChart__hit"
            x={PAD.left + band * i}
            y={PAD.top}
            width={band}
            height={PLOT_H}
            tabIndex={0}
            role="button"
            aria-label={`${p.label}: ${fmt(mode === "cumulative" ? p.cumulative : p.amount, currency)}`}
            onMouseEnter={(e) => updateTooltip(i, e)}
            onMouseMove={(e) => updateTooltip(i, e)}
            onMouseLeave={() => {
              setHover(null);
              setTooltip(null);
            }}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => onSelectPoint?.(p)}
          />
        ))}
      </svg>

      {hovered && tooltip && (
        <div
          className="SpendingChart__tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="status"
        >
          <strong>{hovered.label}</strong>
          <span>{fmt(mode === "cumulative" ? hovered.cumulative : hovered.amount, currency)}</span>
          {mode === "bars" && hovered.posts.length > 0 && (
            <span className="SpendingChart__tooltip__meta">
              {hovered.posts.length} post{hovered.posts.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SpendingChart;
