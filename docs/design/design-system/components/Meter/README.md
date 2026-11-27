# Meter

Bars for money.

- **Budget meter (2026-11):** one meter, not two. A dashed `border-hairline` track (a target) for the budget, filled up to what's spent and **split into category segments** in the chart fills (`chart-1` … `chart-4`, `chart-rest`; under Display → Charts: mono, the 1-bit ramp). Each segment is a focusable button whose label carries name, share and amount; hover or focus shows a tooltip (swatch · name · `22% · ¥ 10,600`). Category names never appear in a legend under the bar: they can be any length. Over budget: the track goes `border-heavy`, solid, and the percentage inverts.
- **Placement:** wide screens put it in the summary row beside month nav and total; medium screens and phones give it its own row under them.
- **Breakdown list:** the names live in the breakdown (aside on desktop, `[+] breakdown` on phones): swatch · name (ellipsised, full on hover) · share.
- **Plain meters** (a category's own budget row, progress) stay solid ink on a 1px track.

**Consumer provides:** budget, spent, segments (label, share, amount), over state.
