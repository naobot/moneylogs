# Implementation plan

One PR at a time, in this order. Each PR: read the files listed, change only what it says, add or refresh a visual test, and check its "done when". Behaviour changes are kept out of the styling PRs.

## Phase 1 · Foundations (`screens/00-foundations.md`)

1. **Tokens.** Bring `src/tokens.scss` / `App.scss` in line with `design-system/tokens.json`: phone type ladder (36/18/14/13/12/11, nothing under 11px), spacing rhythm (`gap-inside` 4, `gap-between` 8, `gap-group` 18, `gap-section` 28; UI size scales only the inner two), `tap-target` 44px at every UI size, `border-fresh` 4px, `shadow-float`, `radius-bubble`. No visual change intended beyond the type floor and tap targets.
2. **Clean-up.** Work through `design-system/clean-up.md`: retired colours, radii, shadows, weights, one-off sizes, the Vite `index.css` leftovers, blue focus ring. Mechanical; split by area if the diff gets large.
3. **Hover discipline.** Move every hover style behind `@media (hover: hover)`; add `:active` inversion for touch.

## Phase 2 · Building blocks (`design-system/components/`)

One component per PR, each with a visual test of its states. Order by how many screens need it:

4. TitleBar (striped, flush with the view toggle) + SectionLabel
5. Segmented (primary 2px / sub-choice 1px) + Disclosure `[+]`/`[-]`
6. Switch + Check `[x]`/`( )`
7. Field, TextArea, Amount (dashed = you type), Select (styled native, solid)
8. Modal as a bottom sheet on phones / 450px box on wide (black header, pinned footer)
9. Menu + MenuTrigger (floating layer)
10. Bubble (+ NudgeBadge) and the Comment tail
11. ActionPair + TextButton
12. FreshNotice, Snackbar (toasts), UpdateBanner
13. Meter (colour-coded by category, hover tooltips) + Chart colours as the default
14. KnickKnack tile + Rarity tag
15. Slides

## Phase 3 · Screens, in audit order (`screens/`)

One screen per PR, phone and wide together:

16. S1–S2 financial log (pilot: do this one first and review it closely, it sets the pattern)
17. S3 stats
18. S4 social log + comment sheet
19. S5 home
20. S6 settings
21. S7 notifications
22. S8 modals
23. S9 create wizard + invites
24. S10 login + welcome
25. S11 landing
26. S12 knick-knacks + gifting
27. S13 caret menu, profiles, share card
28. S14 month review, no-spend, nudges, toasts, sublog slides

## Phase 4 · Behaviour changes (own PRs, with tests)

29. **No-spend days for past days of the current month.** Allow confirming any past day this month with nothing logged; show those empty days in the entry list (¥ 0) with their own check; earlier months unchanged; the buddy cheers only for today. Needs the data layer and its rules, not just UI.
30. **Profile actions.** "✓ friends" becomes status text; unfriend moves into the title bar's ⋯ with its confirm sheet; poke · cheer become one pair under "send a gift".
31. **Home friends menu.** Poke · cheer · profile from each avatar, and the `!` nudge badge opening the bubble (much of this exists in `DashboardFriends`; align it with the spec).

## Working rules

- Read `design-system/README.md` before the first PR of a session.
- Class names: keep the ones in `src/`; new components use the names in `design-system/components/bundle.css` unless the code already has a better one.
- Copy: use the app's existing strings. Don't invent copy; if a board shows text the code doesn't have, flag it in the PR.
- If a spec and the code disagree on behaviour, stop and ask in the PR description rather than guessing.
