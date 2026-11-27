# S7 notifications

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/Notifications.dc.html` — S7 · notifications
- `boards/DesktopNotifications.dc.html` — S7 · bell pop-up on wide screens

## Canvas notes

Notifications · what's busy

1. The page sits in a Window (2px frame, 30px padding), like settings.

2. One flat list with dotted separators: new and old only differ by a 4px rule on the left.

3. Every row inverts on hover and stays inverted after a tap on touch screens.

4. Time is 0.8em at 0.7 opacity ≈ 9px on phones; the detail line 0.9em at 0.7.

5. The bell's pop-up is a hover popover at 0.85em with no header.

What changed

1. No Window on phones: striped title bar, then two sections, new · 3 and earlier, each a section label.

2. New rows keep the 4px rule: border-fresh means exactly "new since your last visit".

3. Rows: 20px icon, the sentence at 14px with names bold, one muted detail line (ellipsised), time top right at 12px. Press inverts; hover only where it really hovers.

4. The bell's count is an 11px inverted tab.

5. Desktop: the pop-up is an overlay, so it gets the black header bar (notifications · 3 new) and a see all › footer.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
