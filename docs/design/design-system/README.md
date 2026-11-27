moneylogs looks like a well-kept terminal printout: two inks, one monospace face, square frames, and emphasis made by turning a block inside out. Every rule below follows from that. When in doubt, ask "could a 1-bit screen draw this?" — if not, don't.

The rules marked **(2026-11)** come from the small-screen audit of 26 November 2026. They are the agreed design; the code catches up screen by screen.

## Principles

1. **Two inks, nothing else.** `ink` on `paper`. Hierarchy comes from weight, frame, case, inversion and texture — never from a new hue. Do not add colours, gradients or soft shadows; the one shadow is `shadow-float`, a hard offset for floating things (see Floating layer). Corners are square unless rounding is a deliberate, named exception (see Corners). The colour themes are skins: each is one more paper/ink pair, and the rules don't change (see Colour).
2. **Inversion means "this one".** Active, selected, pressed, pinned, new, the step you're on. It is never used to mark structure. Two fixed exceptions keep the original black bar (see Inversion budget). Swap `inverse-surface` / `inverse-ink`; don't invent a second highlight.
3. **Frames are hierarchy, line style is meaning.** How thick a rule is says how important the box is; whether it is solid, dashed or dotted says what kind of thing it is. **(2026-11)** Most things need no frame at all: see Surfaces.
4. **The machine speaks lowercase.** Headings and labels the app writes are lowercase; buttons are small caps-lock; what people typed keeps its own case.
5. **Show progress for anything async.** Loader bars, blinking ellipses and skeleton rows — never a frozen screen.
6. **(2026-11) Quiet by default, more on request.** Secondary blocks (a breakdown, a review, the entry form on phones) start folded behind `[+]`. A phone screen should show one number, one list and one place to act.

## Content fundamentals

- **Voice:** plain, friendly, a little dry. Speaks to the reader as "you", about the app's objects by their names: _log group_, _financial log_, _log post_, _entry_, _category_. Example: "Hide this log group from your navigation and lists. Only you are affected, and you can still open it."
- **Casing is done in CSS, not copy.** Write sentence case in source ("Spending patterns"); `h1–h6`, `.Modal__title` and drawer titles render it lowercase, and `.Button strong` renders it uppercase. Wrap user content and codes that must keep their case (log titles, names, `JPY`) in `.keep-case`.
- **Buttons are verbs**, short: "Save", "Add", "Pin", "Load older posts", "Sign out". Soft refusals are allowed: "Nevermind".
- **Destructive copy names the blast radius**: "every post, comment and uploaded image", "it disappears from all members' navigation, lists and history".
- **Separators are a middle dot** with spaces: `financial · shared`, `12 mar · 14:02`.
- **No emoji.** Glyphs that a terminal could print are welcome: `[+]` `[-]` for disclosure, `‹ ›` for steppers, `…` for pending, `·` for separators, `[x]` `[ ]` for checkboxes, `( )` `(•)` for radios, `⋯` for a row's actions, `!` before a danger heading.
- **User-named things can be any length.** Category, log and member names ellipsise in tight spots (bars, legends, rows) and show in full on hover or focus. Never lay out a legend that assumes short names.

## Colour

| Token                                  | Use                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `paper`                                | Page ground.                                                                          |
| `sheet`                                | A raised surface: cards, the open entry form, dropdowns — always inside an ink frame. |
| `ink`                                  | Text, rules, frames, icons, fills.                                                    |
| `ink-muted`                            | Secondary text. The lightest ink you may set words in (5.5:1).                        |
| `ink-faint` / `ink-ghost` / `ink-wash` | Non-text only: disabled, row separators, skeletons, chart grid and area.              |
| `inverse-surface` + `inverse-ink`      | The inverted block. Always as a pair.                                                 |
| `scrim`                                | Modal and sheet backdrop.                                                             |
| `focus-ring`                           | Keyboard focus.                                                                       |
| `chart-1` … `chart-6`, `chart-rest`    | Categorical chart fills only.                                                         |
| `accent`, `accent-inverse`             | Links inside user content only.                                                       |

- Set body copy in `ink` on `paper` or `sheet`. Secondary copy in `ink-muted`, never by lowering `opacity` on text below 0.7 (0.6 gives 4.0:1 and fails). **(2026-11)** Nothing fades a whole card or row to show it is old or less important: past items use dotted separators instead.
- On an inverted block use `inverse-ink` — not `#fff`, not `#e8e6e3`.
- **Themes are skins.** Paper (light) and Night shift (the same two inks swapped) plus fifteen colour themes in four families — _retro_ (Amber CRT, Blueprint, Riso, Gilt), _pastel_ (Mint, Lavender, Peach, Butter), _aero_ (Aqua, Meadow, Aurora), _after dark_ (Phosphor, Midnight, Oxblood, Forest). Each is one `paper`/`sheet`/`ink` pair; `ink-muted` and the other inks are that ink at fixed alphas, and `ink-muted` stays ≥ 5:1 on paper and sheet. Components written against tokens get every theme for free. Icons, being black `<img>`s, are recoloured with a per-theme filter.
- **Chart colours.** Categorical charts (category bars, the budget meter's segments, pies, swatches) use six muted fills per theme, picked in OKLCH so neighbours differ in lightness too. They are the only colours outside the two inks and never touch text, frames or UI. **Display → Charts: mono** swaps them for the 1-bit ramp (paper → dots → hatch → dither), with the grouped rest in solid ink. Single-series charts (spending bars, the cumulative line, plain meters) stay in ink either way.

## Type

- **One typeface: Hack** (`--font-mono`; regular, bold, italic, bold italic; `fonts/Hack-*.woff2`; MIT + Bitstream Vera licence), self-hosted, for everything. No second face.
- Hierarchy comes from size, weight and case, not from type families: headings lowercase, button labels caps-lock, user content in its own case.
- Desktop scale (at a 16px root): `display` 3.2em · `heading-1` 2em · `heading-2` 1.5em · `heading-3` 1.17em · `heading-4` / `body` 1em · `small` 0.85em · `caption` 0.8em · `micro` 0.7em.
- **(2026-11) Phone ladder, in rendered px:** `phone-display` 36 (28 when it shares a row) · `phone-heading` 18 · `phone-body` 14 · `phone-small` 13 · `phone-caption` 12 · `phone-micro` 11. **Nothing renders below 11px on any screen.** Components pick a step in rem; they don't shrink with nested `em` (a 0.7em header inside a 0.8em root came out at 9px; the members strip at 7.7px).
- Weights: 400 and 700 only.
- `label-caps` for button text: Hack bold, uppercase, 0.04em tracking (12px on phones).
- `numeral` for money: bold where it is the point of the row, `tabular-nums` always, right-aligned in columns.

## Surfaces (2026-11)

Three tiers, and only three:

| Tier          | Looks                       | Holds                                                                        |
| ------------- | --------------------------- | ---------------------------------------------------------------------------- |
| **ground**    | `paper`, no frame           | Rows, totals, labels, lists — content you read. Most of every screen.        |
| **card**      | `sheet` + `border-hairline` | One item among many: a post, a log on the home screen, a choice.             |
| **container** | `sheet` + `border-rule`     | Where you act: the open entry form, a modal's body on desktop. One per view. |

Sections on the ground are separated by space and a **section label** (a bold 13px lowercase label on a 1px rule, with an optional muted count or a 44px text action at the right), not by boxes.

## Frames and line styles

| Weight | Token             | Means                                                                                                    |
| ------ | ----------------- | -------------------------------------------------------------------------------------------------------- |
| 1px    | `border-hairline` | A card, a sub-choice (periods), a select, a meter track, a section label's rule.                         |
| 2px    | `border-rule`     | The one container per view, a primary button, a primary segmented control, the page's title bar.         |
| 3px    | `border-heavy`    | Danger and errors: the danger zone's rule, a destructive button, a field in error, an over-budget meter. |
| 4px    | `border-fresh`    | New since your last visit. Nothing else.                                                                 |

| Style  | Means                                                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| solid  | Committed, structural; **you choose** (selects, dates, segmented controls).                                                                                      |
| dashed | Editable — **you type** (fields, text areas, amounts, the collapsed entry bar), itemised (row separators), or a target (the budget track). Turns solid on focus. |
| dotted | Past or archived (ended logs, a past log's nav button), chart grid.                                                                                              |

Row separators inside a list use `ink-faint` dashes; the section label's rule above them stays full ink, so groups read as groups. Layering is said with a frame and the `scrim`. **(2026-11)** The exception is the floating layer below: menus, popovers and toasts sit on `shadow-float`.

## Corners: square by default, round on purpose

| Token                                | Where                                                  | Why                                                |
| ------------------------------------ | ------------------------------------------------------ | -------------------------------------------------- |
| `radius-none`                        | everything else                                        | The terminal default.                              |
| `radius-tab` (6px, top corners only) | filing-folder `Tabs`                                   | A paper folder tab.                                |
| `radius-bubble` (10px)               | speech bubbles: `Comment`, the buddy's bubble, a nudge | A comic speech balloon, so it always has its tail. |

To add an exception: name the physical object it imitates, give it its own `radius-*` token, and apply it to that one component. A corner rounded "because it looks softer" is not an exception.

## Inversion budget (2026-11)

- **State only.** The selected log in the nav, the active segment of a control, a pressed button, a chosen radio row, the wizard's current step, a `pinned` or `3 new` tag, an over-budget percentage. Every inverted block should be something you could tap away from.
- **Two exceptions keep the black bar:**
  1. **Today's day header** in the entries list and the social feed (`today · thu 26 nov` with the day's total). Once per list: everything under it is the past. Earlier days use a section label.
  2. **The header of anything on top of the page**: modals, bottom sheets, the comments sheet, an opened review box. A black bar means "you are working in this right now".
- **Not inverted any more:** page headers (they use the striped title bar), the stats strip, every day header, the danger heading, whole pinned posts.
- Most phone screens show one structural black bar; two while a sheet is open.

## States

- **Hover / focus on anything clickable that is a box** (LogCard, menu item, choice, row button): flip to `inverse-surface` / `inverse-ink`. **(2026-11)** Only behind `@media (hover: hover)`; on touch, invert on `:active` instead, so a tapped card doesn't stay black when you come back. List rows on desktop get a quieter hover: `sheet` + hairline outline, and their actions appear.
- **Active / selected:** stay inverted and stop being interactive (`cursor: default`).
- **Disabled:** whole control at `opacity-disabled`, no hover change.
- **Focus:** 2px solid `focus-ring`, offset 2px. Inside an inverted block use `inverse-ink`, offset -4px. Never the browser's blue.
- **Error:** the field's frame goes `border-heavy`, with a `!` message in caption under it. Never red.
- **Loading:** a framed Loader bar for pages; a `…` that blinks with `steps(1)` for inline waits; `ink-ghost` skeleton bars pulsing 0.12 ↔ 0.3 for rows.

## Texture — the variation layer

Texture is a 1-bit fill — the dithers, hatches and stripes early bitmap screens used to fake grey — drawn in `ink` through a CSS mask, so it themes with everything else and adds no colour.

| Class         | Pattern               | Use                                                                |
| ------------- | --------------------- | ------------------------------------------------------------------ |
| `.tex-dots`   | 1 px in 4 (25%)       | Quiet fills: empty states, a mono chart slot, a photo placeholder. |
| `.tex-dither` | checkerboard (50%)    | The middle step of a ramp; a "pending" block.                      |
| `.tex-hatch`  | 45° lines             | Over-budget overflow; "excluded" / not counted.                    |
| `.tex-stripe` | horizontal 1-on-1-off | Reserved; the title bar uses its own airier stripe (below).        |
| `.tex-grid`   | 8 px graph paper      | Behind charts and empty canvases.                                  |

Rules: at most one texture per component; never under text unless the text sits on a solid `paper` or `ink` label; mono chart ramps go solid → dither → hatch → dots → paper so neighbours differ in density, not just pattern.

## Title bar (2026-11)

**Every page's header is a striped title bar**, the chrome of early desktop windows: a `border-rule` frame, 1px ink stripes with 3px gaps inset from the frame (6px top and bottom, 4px at the sides), and the page title on a `paper` label at the left. Actions sit on a second paper label at the right — icon buttons on phones and medium screens, icon + word on wide ones. On a log, the title bar sits **flush on top of** its view toggle (entries | stats, digest | summary): they share one 2px line and read as one unit. Striped means "this page"; modals do not use it (they use the black bar).

## Layout (2026-11)

- **Phones (≤ 600px):** no `Window` frame around pages — the title bar is the header and content runs edge to edge inside 12px. One column. Every modal is a **bottom sheet** (see Modal). The entry form folds into a dashed `[+] add entry` bar. Row actions sit behind one 44px `⋯`.
- **Medium (768–1300px):** three columns (sidebar · main · aside), the aside 200px. Month nav and the total (with "62% of budget") share a row; the budget meter takes its own row below.
- **Wide (1300px and up):** the same three columns. Month nav, total and budget meter share one row. The entry form stays open in one row. Row actions are visible icon buttons on hover.
- **The aside** holds the budget buddy (unframed) and, below it, the category **breakdown** list, open by default.
- **The sidebar** stacks its groups (views, periods, sublogs) with no headings: each group is one joined stack, groups 18px apart, the first flush with the top of the main column.

## Action weight (2026-11)

A screen gets **one** full-size main action; everything else steps down, so look-alike buttons don't pile up.

- **Main action:** 2px frame on white (`sheet`), full width on phones (send a gift, give one, keep it, let's look, share).
- **Light, repeatable actions** (poke · cheer): one joined pair in a 1px frame, split by its line, words in body case. They read as one control, not two big buttons. Same pair on the profile and in the home friends menu.
- **Quiet alternatives** (skip, ask me tomorrow, not this month, re-roll knick-knack): a text button with a dotted underline, 40px tall.
- **Rare or destructive** (unfriend, leave, delete): behind the title bar's `⋯`, then a confirm sheet with a 3px button. Never on the page itself.
- **Relationship and status** ("✓ friends", "request sent") are words beside the identity, not buttons. Waiting states (request sent) sit in a dotted frame; things that need your answer (wants to be friends) take the 4px fresh edge.

## Floating layer (2026-11)

Menus, popovers and toasts float above the page without blocking it, so they get a `border-rule` frame on `paper` and `shadow-float`, the only shadow in the system. Sheets and modals never use it (they have the `scrim`).

- **Menu:** 44px rows on phones (36–40 on wide), split by 1px or dotted rules. The button that opened it inverts while it's open: open is a state.
- **Toast:** stacks at the bottom on phones, bottom-left on wide screens (away from the buddy). Success: 2px frame + `✓`. Error: 3px frame + the `warning` icon, `role="alert"`. Always a close `×`; words are a sentence ("Sent to mika: “proud of you”").
- **Speech bubbles** are the other floating thing: `sheet`, 1px, `radius-bubble`, with the tail aimed at whoever is talking (the buddy, a friend's avatar, a commenter). No shadow: the tail does the lifting.

## Notices (2026-11)

- **Fresh news** (an alert in the drawer, the update banner, a month review waiting, an incoming friend request) is a box with the 4px `border-fresh` left edge. An alert row adds the bouncing `warning` icon and a `›`.
- **Something waiting from someone** (a nudge, a gift on its way) is the `!` badge: bold `!` on a filled ink square, no rounding, on the corner of the avatar or beside the buddy. Tap it for the bubble.
- **A confirmed no-spend day** settles into a dotted line, "✓ no-spend day", under that day's header. The check to confirm sits there too: for today, and for any past day **of the current month** with nothing logged. Those empty days show in the list (with ¥ 0) only so they can be confirmed; earlier months stay as they are.

## Knick-knacks (2026-11)

- Art is the catalogue's 32×32 grid, drawn as ink pixels (`shape-rendering: crispEdges`) at whole multiples: 40 or 44 in lists and shelves, 64 in the drawer, 96 in a reveal, 128 in details. It recolours with every theme like any ink.
- A tile is a `sheet` card with a 1px frame, the art, the name, and `×n` top right when there's more than one.
- **Rarity climbs by line weight, never by inversion:** everyday dotted · uncommon 1px · rare 2px · unique and special 2px + `shadow-float` + `star`.
- The found line is the buddy talking, so it sits in a speech bubble from the buddy's face.
- In giving mode, things that came with an achievement are disabled (dotted, `opacity-disabled`, a tooltip says why). A gift still wrapped on someone's shelf is dotted, at full strength.

## Spacing and layout tokens

- Steps `space-1` … `space-7` (0.2em → 2em). Window interior `window-pad` (30px, desktop only); column gap `column-gap` (20px).
- **(2026-11) Rhythm:** `gap-inside` 4 < `gap-between` 8 < `gap-group` 18 < `gap-section` 28. UI size scales the two inner steps only, so S never runs sections together.
- **(2026-11) Tap targets:** `tap-target` 44px for anything tappable on a phone, at every UI size. The drawn control can be smaller; its hit area can't.
- Content column caps at `main-width` (800px), the log menu at `sidebar-width` (420px), modals at `modal-width` (450px). **(2026-11)** One exception: the share card box is 640px on wide screens, so the preview and its options sit side by side.
- Breakpoints `bp-sm` 600px, `bp-md` 768px, `bp-xl` 1300px.
- Each page scrolls its own body; the nav and footer stay put.

## Controls (2026-11)

Which one?

| Control                      | For                                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Switch**                   | A setting that is on or off and saves at once (colour charts, the email digest, a fixed cost). Square track, inverted when on; the whole row is the hit area.                                                           |
| **Checkbox** `[x]` / `[ ]`   | Choosing some items from a list (rows to import, friends to invite). Text-mode mark over a hidden native input. Checked rows don't invert.                                                                              |
| **Radio rows** `( )` / `(•)` | One of a few answers that each need a sentence (the wizard's saving styles). Stacked 1px rows; the chosen row inverts.                                                                                                  |
| **Segmented**                | One of 2–4 short options. One joined control: 2px frame for a primary choice (entries                                                                                                                                   | stats), 1px for a sub-choice (week | month | year). Active segment inverted. |
| **Select**                   | One of many, or options too long for a row. A real `<select>` with `appearance: none` in a 44px solid frame with a `▾` cell, so phones keep their own picker. Inline variant (`JPY ▾`, underlined) in headers and rows. |
| **Listbox**                  | Long or searchable lists (currency, place picker): a container with a `>` search line on top, 44px options, the chosen one inverted.                                                                                    |
| **Text field**               | Boxed 44px, dashed frame, label above, for forms; `LineInput` (dashed underline) for in-place edits.                                                                                                                    |
| **Text area**                | The same dashed frame; grows 3 → 8 rows; footer strip with "markdown ok" and a counter.                                                                                                                                 |
| **Amount**                   | A text field with the currency as a solid prefix cell; bold, right-aligned, tabular.                                                                                                                                    |
| **Disclosure** `[+]` / `[-]` | Secondary blocks that start folded. 40–44px text button; the opened content hangs off a dotted rule. Remember each one's state per user.                                                                                |

## Motion

Short and mechanical. `0.3s ease-in-out` for opacity and height reveals; `0.2s ease-out` for the snackbar dropping in and sheets rising; `1s steps(1)` for blinking; `1.2s` pulse for skeletons; `1s ease-in-out` for the loader bar's width. **(2026-11)** One thing bounces: the budget buddy's face when it reacts, and the `!` that says something is waiting for you (a find, a gift, a nudge). `0.45s` once for the face, a gentle loop for the `!`; both stop under `prefers-reduced-motion`. Nothing else bounces.

## Iconography

- Pixel-art SVGs from the Noun Project, credited by artist in the file name (`nakals-`, `reandra-khansa-`, `kanyayee-`, `bluetip-`), plus ten drawn in-house (`moneylogs-`). All are single-ink black, shown as `<img>`. See the Icons asset group.
- Default size `icon-md` (21px) inline, nudged 5px down to the baseline; `icon-sm` (16px) in small text.
- On an inverted surface, in night shift and in the colour themes, apply the theme's icon filter (`.Icon--inverse` on inverted blocks); an `<img>` cannot inherit `currentColor`.
- **(2026-11)** Use icons for repeated row actions on wide screens (pencil to edit, bin to delete) and for title-bar tools, always with an `aria-label` and a tooltip. Words stay where there's room for them and where the action is rare.
- **(2026-11) Icon + count instead of a phrase.** The pixel icons carry the app's whimsy, so small recurring labels are an icon and a number, never caps words: new posts in a social log `notification` + n (as the member badge does), new comments `speech`, new entries `document` + n (both in the inverted tag), comments `speech` + n (`speech` + `+` when there are none), reactions `smiley`, pinned `pin` alone in a small inverted square, unread notifications `bell` + n, see all `folder` / `bell` + n + a caret turned right, new log `plus` + "new log". The full phrase goes in `aria-label` and `title`.
- **Where each icon lives in `src` (synced 2026-11-26):** nav `home`, `user` (/me), `bell` (notifications), log buttons `dollar` (financial) and `social` (log groups), menu trigger `caret`; in the menu `eye` (quick display options), the theme toggle `sun` / `star` (colour theme) / `moon`, `exit` (sign out). `social` also means friends (friend requests, achievements). `smiley` adds a reaction to a post. `gift` gives a knick-knack (friend profile, knick-knack details, gift notifications). `wallet` is the no-budget call to action in stats. Log headers: `gear` manage, `pencil` categories, `document` import / new entry, `plus` invite. Nine of these (`bell`, `caret`, `eye`, `folder`, `gift`, `smiley`, `social`, `star`, `wallet`) are drawn in-house (`moneylogs-` prefix); all 29 are in the Icons asset group.
- **(2026-11) Comment bubbles keep their tail.** `radius-bubble` is only sanctioned because the box is a speech balloon: every rounded comment box has its pointer tail (an ink triangle with a sheet triangle inside, 13/12px, ~12px from the top) aimed at the commenter's avatar, 16px to its left. A rounded box without a tail is not allowed.
- New icons must be pixel-grid, single-ink, square-cornered, no anti-aliased curves. Draw them in-house (`moneylogs-` prefix) if no match exists.
- The favicon (Logos) is the only mark: a 16×16 pixel drawing in `ink` on `paper`. There is no separate logo; set the name "moneylogs" in the mono face, bold, lowercase.

## Components

Static renditions of the app's own classes live under Components; they share `components/bundle.css`, which reads only these tokens. Class names match the codebase so a preview can be lifted straight into `src/`. Components added or changed in the 2026-11 audit (Switch, Check, Disclosure, SectionLabel, TitleBar, Menu, Bubble, ActionPair, TextButton, FreshNotice, KnickKnack, Slides, and the new Modal, Segmented, Field, Meter, DangerZone, Steps, EntryList, ChoiceCard, Snackbar and UpdateBanner looks) are drawn with tokens in their previews; their class names are settled when they land in `src/`.

The full audit, S1–S14 with every screen before and after on phones and wide screens, lives on the "moneylogs — small-screen UI audit" design canvas.
