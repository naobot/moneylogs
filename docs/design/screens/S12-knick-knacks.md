# S12 knick-knacks + gifting

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/KkFind.dc.html` — S12 · buddy find + reveal
- `boards/KkDrawer.dc.html` — S12 · drawer, details, gift
- `boards/KkProfile.dc.html` — S12 · friend profile + shelf
- `boards/DesktopKk.dc.html` — S12 · drawer on wide screens

## Decisions made in review (these win over the notes below)

- The friend profile on this row follows S13's layout (send a gift main; poke · cheer pair; unfriend in the title bar's ⋯).
- A gift still wrapped on someone's shelf is dotted at full strength (no fading). Achievement items in giving mode are disabled (`opacity-disabled`, dotted, tooltip).

## Canvas notes

S12 · knick-knacks

1. Real 32×32 art from art.ts, drawn as ink pixels, so every skin recolours it.

2. The buddy's “!” and the drawer alerts use the warning icon with its bounce. Alerts are fresh news, so they take the 4px left edge, not a dashed frame (dashed means you type).

3. Reveal, details and gift are bottom sheets with black headers. The found line sits in a speech bubble from the buddy's face, so it reads as the buddy talking.

4. Try it: tap the bubble → next → keep it. In the drawer tap acorn (give one → gift sheet) or copper coin (can't be given).

Rarity without inversion

Inversion is kept for state, so the rarity tag climbs by line weight instead:

everyday · dotted
uncommon · 1px
rare · 2px
unique / special · 2px + offset shadow + star

Giving mode (from a friend's “send a gift”) is a state, so its banner is the black one. Things that came with an achievement go dotted and faded there, with a tooltip saying why.

On the shelf, a gift still wrapped is dotted and faded: dotted already means past/not-now.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
