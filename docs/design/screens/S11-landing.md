# S11 landing page

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/Landing.dc.html` — S11 · landing page (full scroll)
- `boards/LandingInvite.dc.html` — S11 · landing from an invite link

## Decisions made in review (these win over the notes below)

- Keep the full existing landing copy; nothing invented.

## Canvas notes

Landing · what's busy

1. Three full example windows (home, a financial log, a trip) built from the real components: on a phone they're the old, dense UI shrunk into a frame.

2. Each feature point is its own 1px box, so the three point lists become long stacks of boxes.

3. The hero has three separate buttons of different weights (create, sign in, try without an account).

4. The invite bar is a fixed 2px box over the page.

5. Everything is centred or boxed, so nothing leads the eye down the page.

What changed

1. A slim top bar (wordmark, sign in), then the hero: 40px wordmark, the pitch split into one line that sells and one quieter line, a full-width create an account (2px), and sign in · try without an account under it.

2. Example windows keep the striped title bar with an example tag, now drawn with the new parts and cut to 2–3 items each, including today's black bar and the colour budget meter.

3. Feature points are plain rows on dashed rules under an 18px heading, not boxes. How it works uses the numbered step squares.

4. From an invite link, the guest option goes and the invite bar is a pinned black bar (overlay rule) with create an account.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
