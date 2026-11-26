# Chart

The spending chart: hand-drawn SVG bars, cumulative line and area in `ink` only — a single series, so no chart colours.

- Bars `ink`; on phones past months at `ink-faint` and the current one solid; non-hovered bars dim to `ink-faint` while one is inspected.
- Line 2px `ink`, square caps and mitred joins; area `ink-wash`; dots `ink` ringed in `paper`.
- Grid dashed `ink-ghost`; ticks 11px `ink-muted` (the floor).
- Tooltip: a `sheet` box in a 1px frame, amount bold, meta line below.
- **Categorical** charts (category bars, the budget meter, pies) use `chart-1` … `chart-6`; see Meter.

**Consumer provides:** a series of {date, amount, count}, mode (`bars` | `cumulative`), and the noun for counts ("post"/"posts").
