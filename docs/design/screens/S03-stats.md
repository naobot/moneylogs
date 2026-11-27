# S3 financial log stats

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/StatsProposed.dc.html` — S3 · financial log stats · proposed
- `boards/DesktopStats.dc.html` — S3 · stats on wide screens

## Decisions made in review (these win over the notes below)

- Category swatches and bars use the chart colours (C1–C4 + rest) by default.
- The `wallet` icon is the no-budget call to action.

## Canvas notes

Financial log stats · what's busy

1. Three nested surfaces: an inverted summary strip inside a sheet panel inside a 2px frame.

2. The currency "Segmented" control is separate framed buttons with gaps, not one control.

3. Section headings at ≈11px sit as close to their content as rows do, each with an ~18px "edit" row button beside it.

4. Notes at 0.75em and 0.7 opacity ≈ 9.6px.

5. The month review card adds another 2px frame with an inverted header above everything.

What changed

1. Same unit with stats active; week | month | year is a 1px segmented sub-choice right under it.

2. The total is in display numerals on the ground, no strip; budget is a dashed (target) meter.

3. Sections are labels on a hairline rule with a 44px text action ("edit"), separated by section spacing.

4. Category rows: textured swatch, name, amount, share, with the share bar on its own line.

5. Month review and insights sit behind [+]. Press Play to open them.

Wide screens · batch 1

Social: digest / summary as a joined stack above the members list (avatars, fresh 4px, a 2 new tag). The post you're reading is the one 2px container; its comments fill the right column, with the comment box at the bottom.

Stats: summary row as on entries; categories as one table (swatch, name, amount, share, budget track), month by month in ink. The aside holds the buddy, october in review (black header, it's an open box) and insights.

Home: now cards in a row of three (1px; fresh 4px), coming up and recently ended side by side as rows, friends and the knick-knack drawer (open here) in the side column.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
