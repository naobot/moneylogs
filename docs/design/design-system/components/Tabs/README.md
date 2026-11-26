# Tabs

Filing-folder tabs that rise out of the top rule of the `Window` directly below them.

The active tab's bottom edge takes the `paper` colour so it merges with the box; inactive tabs are `ink-muted` and darken on hover.
**Consumer provides:** `tabs` ({id, label}), `activeId`, `onChange`, `ariaLabel`. Always followed by a `Window` sibling.
Top corners use `radius-tab` (6px 6px 0 0) — one of the two sanctioned rounded corners, because the tab imitates a paper folder. The active tab is also bold, so it doesn't rely on the frame alone.
