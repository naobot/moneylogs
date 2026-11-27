# S14 buddy moments, nudges, toasts, slides

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/BuddyReview.dc.html` — S14 · month review with the buddy
- `boards/NoSpendDay.dc.html` — S14 · no-spend day
- `boards/NudgesHome.dc.html` — S14 · nudges on home
- `boards/Feedback.dc.html` — S14 · update banner + toasts
- `boards/SublogSlides.dc.html` — S14 · sublog intro slides
- `boards/DesktopMoments.dc.html` — S14 · review, banner, toast on wide screens

## Decisions made in review (these win over the notes below)

- **Behaviour change:** no-spend days can be confirmed for today and for any past day **of the current month** with nothing logged. Those empty days show in the entry list (¥ 0) with their own `[ ] nothing spent on …` check; once confirmed: a dotted "✓ no-spend day" line. Earlier months don't change. The buddy cheers only for today.
- The nudge badge is a bold `!` on a filled ink square (as `.NudgeBubble__alert` today), no rounding.
- Sublog slide examples sit in a plain 1px card (the 4px edge is only for fresh news).

## Canvas notes

S14 · the small moments

1. Month review: the buddy asks in its bubble. “let's look” is the one real button; “ask me tomorrow” and “not this month” are quiet text buttons. Then the review card opens on last month's stats with the 4px fresh edge: adjust budgets / keep them.

2. No-spend day: in the evening, an unticked “[ ] nothing spent today” under today's header in the entry list (solid: you choose). Once confirmed it settles into a dotted line, “✓ no-spend day”, and the buddy cheers. Past days can be confirmed too, within the current month: an empty day of this month shows (¥ 0) with its own check; earlier months don't.

3. Nudges: a friend who sent you something gets the bouncing warning badge on their avatar; tap it for the bubble (“mika poked you ×3 · proud of you”). Tapping any friend opens the same poke · cheer pair as the profile, plus “profile ›”.

Feedback, by line weight

Update banner: fresh news, so the 4px left edge, with one refresh button.

Toasts are floating, so they get the popover shadow:
success · 2px frame + ✓
error · 3px frame + warning icon (3px = danger/error)

Phones stack them at the bottom; wide screens put them bottom-left, away from the buddy.

Sublog slides: a tall bottom sheet with a black header. The example sits in a white 1px card (the 4px edge is kept for fresh news); the dots show where you are; skip is a text button, next/back are real ones.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
