# S13 caret menu, profiles, share card

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/MenuDisplay.dc.html` — S13 · caret menu + quick display
- `boards/ProfileStates.dc.html` — S13 · profile, every friend state
- `boards/ShareSheet.dc.html` — S13 · share card sheet
- `boards/DesktopShare.dc.html` — S13 · share + theme toggle on wide screens
- `boards/DesktopProfile.dc.html` — S13 · friend profile on wide screens

## Decisions made in review (these win over the notes below)

- Friends state (phone and wide): "✓ friends" is status text beside the identity; **send a gift** is the one main button; **poke · cheer** sit under it as one joined pair (no "nudge" label); **unfriend** is in the title bar's ⋯ and confirms in a sheet ("Stop being friends with mika? They won't be told, and you can add each other again later.") with a 3px button.
- Other states: me (edit profile), none (add friend), outgoing (dotted "request sent" + cancel), incoming (4px fresh card, accept / decline).
- Share options: names and amounts are nested under the pie option, starting exactly under its label text with a 1px rule on the left.
- Share box is 640px on wide screens (the one exception to 450).
- Wide screens show the theme toggle in the nav beside the wordmark; phones keep it in the caret menu.

## Canvas notes

S13 · menu, profiles, share card

1. Caret menu: a dropdown box (2px frame, small offset shadow, like other floating things). While it's open the caret flips and inverts: open is a state. Tap theme to cycle paper → ★ mint → night shift; it stays open, as in the app.

2. Quick display is a bottom sheet with joined segmented rows: theme, then text / UI / entries sizes. The hint and the “all display settings ›” link sit under a dotted rule.

3. Profiles: use the “who” tweak. Each state gets one control row: add friend (primary), request sent (dotted, it's waiting), wants to be friends (4px edge = fresh, accept / decline), friends (send a gift + ⋯). Your own profile swaps it for edit profile.

Share card

1. The header goes black like every other sheet; the card itself keeps its striped header, since that's the image people post.

2. Options use the [x] text checks; names and amounts tuck under the pie, as they only mean anything with it. Try them: the preview and the note under it follow.

3. On wide screens the box is 640px, not 450: the preview and options sit side by side. It's the one exception to the 450 rule.

4. Wide screens also show the theme toggle in the nav, beside the wordmark; phones keep it in the caret menu.

Friend profile, wide

Fewer look-alike buttons by giving each action its own weight:

1. send a gift: the one full-size button (2px, white).

2. poke · cheer: one joined, smaller pair under a quiet “nudge mika” label. They're light, repeatable taps, so they read as one control, not two big buttons.

3. unfriend: in the ⋯ of the title bar, like a log's own actions. “✓ friends” turns into plain status text beside the avatar.

The shelf gets room to show where each thing came from.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
