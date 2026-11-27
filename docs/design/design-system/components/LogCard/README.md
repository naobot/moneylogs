# LogCard

One log on the home dashboard: a card linking into it.

**(2026-11)** Card tier: `sheet` + `border-hairline`. Only logs happening **now** are cards; their number is this month's spend (20px bold, tabular) with one muted fact beside it. Coming up and recently ended logs are list rows (ended rows on dotted separators: dotted = past), never faded with opacity.
**Parts:** `kind` (12px, `ink-muted`), `badge` (small inverted caps tag, e.g. `3 new`), `title` (user text, keeps case, 16px bold), the number.
**Fresh:** a badge turns the frame to `border-fresh` (4px). That weight means "new since your last visit" and nothing else — now the heaviest frame on the screen.
**Press:** inverts on `:active` on touch; on `:hover` only behind `@media (hover: hover)`.
**Consumer provides:** `to`, `title`, optional `kind`, the number and its fact, `badge`.
