# Foundations and controls (layer 1 + 2)

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/LedgerCurrent.dc.html` — financial log · today
- `boards/Toolkit.dc.html` — separation toolkit
- `boards/Inputs.dc.html` — inputs · fields, text areas, selects, checks

## Decisions made in review (these win over the notes below)

- F1 surface tiers and frame weights · F2 inversion budget · F3 phone type ladder and 11px floor · F4 spacing rhythm (4 / 8 / 18 / 28) · F5 44px tap targets at every UI size.
- Controls C1–C11: switch, segmented, disclosure `[+]`/`[-]`, section label, 44px list rows, collapsed entry bar, `[x]`/`(•)`, text field, text area + post toolbar, select (styled native), listbox / amount / date.
- Chart colours are the default (Display → Charts: colour); mono is the opt-in ramp.
- Hover styles only behind `@media (hover: hover)`; invert on `:active` for touch.
- Per-screen checklist (from the audit map): no structural inverted blocks; at most 2 frame weights in view; nothing under 11px; every tap target ≥ 44px at UI size M; say what's folded and why; one display numeral at most; spacing inside < between < group < section.

## Canvas notes

What makes it busy

1. Five to six inverted blocks on the first screen: page header, active tab, stats strip, every day header. Inversion is meant to say "this one"; here it mostly says "section".

2. A frame on nearly every band (2px, 1px, 2px, 2px…). When everything is framed, frame weight stops reading as hierarchy.

3. Type compounds below the micro floor: the page header is 0.7em of a 0.8 root ≈ 9px; the members strip on social logs is 0.6em ≈ 7.7px.

4. Tap targets: at UI size M --tap-min is 0, so a Button is ~28px tall and a RowButton ~18px.

5. The entry form is always open: about a third of the first screen is input chrome before any entry.

6. The month total, the one number you open this for, sits at ~13px inside an inverted strip.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
