# S5 home dashboard

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/HomeProposed.dc.html` — S5 · home · proposed
- `boards/DesktopHome.dc.html` — S5 · home on wide screens

## Decisions made in review (these win over the notes below)

- The knick-knack drawer shows real pixel art (see S12).
- The friends strip opens poke · cheer · profile per avatar, and shows the `!` nudge badge (see S14).

## Canvas notes

Home · what's busy

1. On a phone every log is a full-width 2px card at least 8.5em tall, so now, coming up and recently ended look alike in one long column.

2. Recently ended cards fade to 0.75 opacity with details at 0.8 inside: ≈0.6 effective, which fails contrast.

3. Cards invert on :hover, which sticks after a tap on touch screens.

4. Kind labels at 0.75em × 0.7 opacity ≈ 9.6px.

5. Friends and the knick-knack drawer stack under everything, so the page runs long.

What changed

1. Now: cards (sheet + 1px) with this month's spend as the number. Fresh keeps 4px + its badge, so it's the loudest thing on the page.

2. Coming up and recently ended become list rows; ended rows use dotted separators (dotted = past, from the system). No opacity fades.

3. Touch inverts on press (:active); :hover only behind @media (hover: hover).

4. Friends are one row of avatars; the knick-knack drawer sits behind [+]. Press Play to open it.

Wide screens · batch 1

Social: digest / summary as a joined stack above the members list (avatars, fresh 4px, a 2 new tag). The post you're reading is the one 2px container; its comments fill the right column, with the comment box at the bottom.

Stats: summary row as on entries; categories as one table (swatch, name, amount, share, budget track), month by month in ink. The aside holds the buddy, october in review (black header, it's an open box) and insights.

Home: now cards in a row of three (1px; fresh 4px), coming up and recently ended side by side as rows, friends and the knick-knack drawer (open here) in the side column.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
