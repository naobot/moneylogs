# S9 create wizard + invites

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/CreateType.dc.html` — S9 · new log: type
- `boards/CreateDates.dc.html` — S9 · new log: dates
- `boards/CreateFriends.dc.html` — S9 · new log: friends
- `boards/InviteSheet.dc.html` — S9 · invite sheet

## Canvas notes

Create + invites · what's busy

1. The wizard sits in a Window, and its back / next row scrolls away with the content.

2. Progress is faded text at 0.45 opacity: under the contrast floor, and it wraps on phones.

3. Each log type is a 2px choice card; hover inverts and sticks after a tap.

4. Dates are four separate label-and-input rows ("Start time (your local time)"), native date and time pickers.

5. The friend picker is names with native checkboxes on the right, in a 16em scroll box.

6. The invite modal centres everything; the link sits in a copy-text area.

What changed

1. Striped title bar (new log), numbered step squares under it, the question at 18px, and a back / next bar pinned to the bottom of the screen, like the sheets.

2. Log types are radio cards (1px, ( ) / (•), chosen inverted). Picking financial changes the steps from 5 to 6: press Play and switch.

3. Dates: starts and ends as sections, each a date and a time select side by side, then a runs 6½ days summary. The time zone is said once.

4. Friends and the invite sheet use [x] rows with avatars and a spots-left count in the section label; the main button says how many (invite 1).

5. The share link is a read-only field with a copy button.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
