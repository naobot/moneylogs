# S1 nav + log strip · S2 financial log (entries), phone and wide

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/LedgerProposed.dc.html` — financial log · proposed
- `boards/SublogLedger.dc.html` — sublog · coffee fund (inside household)
- `boards/DesktopLedger.dc.html` — financial log · wide (1300px and up)
- `boards/DesktopLedgerMedium.dc.html` — financial log · medium (768–1300px)

## Decisions made in review (these win over the notes below)

- The striped title bar sits flush on the view toggle (entries | stats): one unit, one shared 2px line.
- Keep one black bar: **today's** day header. Earlier days use a section label.
- Phone: month nav stays centred; the total is left-aligned (28px) and shares its row with the budget buddy (no frame or dotted line around the buddy).
- Budget meter is colour-coded by category by default, with the category on hover/focus; category names never appear as a legend (they're user-named, any length).
- Wide (≥1300px): month nav, total and budget meter in one row. Medium (768–1300px): total + its caption ("62% of ¥ 78,000 · 4 days left") in one row, the meter on its own row below. Only one spending meter per layout.
- Both medium and wide: the aside holds the buddy and, under it, the breakdown pane (open by default).
- Sidebar: views, periods and sublogs as joined stacks with no headings, 18px apart, the first flush with the main column's top.
- Wide rows: edit (pencil) and delete (bin) icon buttons on hover. Entry rows: `min-height: 44px; padding: 10px 12px; line-height: 1.4` so multi-line notes don't crowd the borders.
- Sublogs: nav chip `↳ coffee fund`; the sublog line in the parent is framed with the nested-frame mark; inside a sublog the crumb "counts as coffee fund in household ›" is a fixed footer.

## Canvas notes

What changed

1. Inversion budget: one active item per control, nothing structural. The page header uses the striped title bar (window chrome) instead.

2. Three surface tiers only: ground (paper, no frame) · card (sheet + 1px) · container (sheet + 2px).

3. entries | stats is a segmented toggle; week/month/year move onto the stats view.

4. Month total in display numerals; the category breakdown sits behind [+].

5. The entry form collapses to a dashed "[+] add entry" bar (dashed = editable). Press Play and tap it.

6. Day labels are caption text on a hairline rule, not inverted strips; rows get 44px.

Tweaks: density (comfortable / compact).

Sublogs

A sublog is its own financial log whose total counts as one line in a parent (here coffee fund inside household).

In the parent: a ↳ coffee fund chip right after household in the nav (smaller, no icon); a framed sheet row in the day's list with the nested-frame mark (a box inside a box), ↳ name, entry count and amount, opening the sublog; the same mark on its breakdown and stats line. Home hangs it under the parent's card on a tree line.

Inside the sublog: one muted line under the header, ↳ your spending here counts as coffee fund in household ›. Its own budget lives in the parent, so the total has no meter.

Also added to: stats (phone, wide), entries (wide, medium), home (phone, wide).

Carries over from phones

1. Striped title bar for page headers, with the kind and actions on paper labels.

2. Inversion budget: active items, today's day header, overlay headers. Nothing structural.

3. Surface tiers: one 2px container per view (here, the entry form); everything else on the ground or 1px.

4. Joined controls: the sidebar's views and periods become two framed stacks, not five separate boxes.

5. Month total in display numerals on the ground; dashed budget meter; textured category bar.

6. Designed inputs (C7, C9) and the 11px floor.

Stays as it is on wide screens

1. The three-column layout: sidebar · main · buddy.

2. Views live in the sidebar, not a segmented toggle.

3. The entry form stays open: there is room for it in one row.

4. Row actions are icon buttons (edit, delete) shown on hover instead of a ⋯ menu.

5. Boxes (cards, menu items) still invert on hover, behind @media (hover: hover). List rows get a quieter hover: sheet + hairline, as on the coffee row.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
