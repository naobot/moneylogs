# S4 social log feed + comment sheet

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/SocialProposed.dc.html` — S4 · social log feed · proposed
- `boards/DesktopSocial.dc.html` — S4 · social log on wide screens

## Decisions made in review (these win over the notes below)

- Icon + count instead of caps words: new posts `notification` + n, new comments `speech`, comments `speech` + n, reactions `smiley`, pinned `pin` alone in a small inverted square.
- The pin button is `aria-pressed="true"` and inverted when pinned; don't also show a separate pinned icon (no double pin).
- Wide comments aside: no "comments" heading. The open post auto-scrolls to the top of its pane and lines up with its comments.
- Comment bubbles keep their tail (see the Comment and Bubble components).

## Canvas notes

Social log feed · what's busy

1. Members strip: summary, digest and every member are the same 2px box at ≈7.7px text, so the 4px "fresh" frame gets lost among them.

2. The header strip does three jobs at ≈9px: time left, new entry, manage / invite.

3. The post header is three centred columns at ≈10px (date · amount · comments), so the amount competes with everything.

4. Post actions are 20px icons at 0.3 opacity: under the contrast floor and the tap size.

5. A pinned post is a whole inverted card, the largest inverted block in the feed.

6. Comments open as a 180px strip of bubbles that scrolls sideways, at ≈10px.

What changed

1. The same title bar + toggle unit as the financial log: digest | summary replace the first two boxes of the members strip.

2. Members are 40px avatar buttons with names at 11px. "all" inverts when active; fresh keeps its 4px frame, now the only heavy frame on screen.

3. Posts are cards (sheet + 1px): author and place top left, amount bottom left in bold, comments as a 44px text button.

4. Pinned is a small inverted tag, not an inverted card. Post actions sit behind one ⋯.

5. Comments open as a vertical bottom sheet with a C8 text area. Press Play and tap "2 comments".

Wide screens · batch 1

Social: digest / summary as a joined stack above the members list (avatars, fresh 4px, a 2 new tag). The post you're reading is the one 2px container; its comments fill the right column, with the comment box at the bottom.

Stats: summary row as on entries; categories as one table (swatch, name, amount, share, budget track), month by month in ink. The aside holds the buddy, october in review (black header, it's an open box) and insights.

Home: now cards in a row of three (1px; fresh 4px), coming up and recently ended side by side as rows, friends and the knick-knack drawer (open here) in the side column.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
