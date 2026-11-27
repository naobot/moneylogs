# S6 /me + display settings

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/MeSections.dc.html` — S6 · settings list
- `boards/MeDisplay.dc.html` — S6 · display
- `boards/MeNotifications.dc.html` — S6 · notifications
- `boards/DesktopSettings.dc.html` — S6 · settings on wide screens

## Decisions made in review (these win over the notes below)

- The 17 themes stay as skins on the new UI; the colour map doesn't change.

## Canvas notes

Settings · what's busy

1. The page sits inside a Window: a 2px frame with 30px padding, so content gets ~310 of 390px.

2. Section rows are split by 2px rules and the whole row inverts on hover; hints are 0.85em at 0.7 opacity ≈ 9px.

3. Display stacks nine settings, each a label over a row of separately framed ~28px toggle buttons that wrap unpredictably.

4. Theme is two controls for one choice: paper / colour / night shift, then a grid of 15 colour swatches.

5. Notifications: a native checkbox for the digest and nine native selects.

What changed

1. No Window frame on phones: the striped title bar is the page header, and the content uses the full width.

2. Section list: 58px rows on 1px rules, title over a 12px hint, › at the end.

3. Display groups its settings (theme, sizes, format). Each multiple-choice setting is a joined segmented control with its label on the left.

4. Theme is one segmented control; picking "colour" reveals the swatches, drawn in each theme's own paper and ink. Press Play and pick colour.

5. Colour charts and the email digest are switches; notification channels use the inline select.

Settings on wide screens

Keeps the nav + pane layout. The section nav is one 2px stack with the open section inverted (state, so allowed).

The pane groups settings under section labels; sizes and format sit side by side. Theme families are rows of swatches in each theme's own inks.

A third column holds a live preview in the chosen theme: today's bar, an entry, the budget meter.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
