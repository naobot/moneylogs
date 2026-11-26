# S8 modals: log actions, categories, budget wizard, import

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/ModalLogActions.dc.html` — S8 · log actions
- `boards/ModalCategories.dc.html` — S8 · categories
- `boards/ModalBudgetWizard.dc.html` — S8 · budget wizard
- `boards/ModalImport.dc.html` — S8 · import
- `boards/DesktopModal.dc.html` — S8 · modal on wide screens

## Decisions made in review (these win over the notes below)

- No dotted line around the budget buddy in the budget wizard.

## Canvas notes

Modals · what's busy

1. Modal text is 0.8em on top of the 0.8 phone root ≈ 10px, and bodies are centred.

2. A floating box with a 1em margin: tall modals scroll inside it, and the buttons scroll away with them.

3. Two header styles (inverted strip, striped tool header) with a ~28px close.

4. Footer buttons are centred and ~28px tall; back and the main action differ only by frame weight.

5. Log actions: the danger zone stacks a 3px rule and an inverted heading inside an inverted-header modal.

6. Budget wizard: progress is faded text (0.45 opacity, under the contrast floor), and each saving choice is its own 2px box.

7. Category detail and import use native checkboxes; import's date order is a native select.

What changed

1. On phones every modal is a bottom sheet: full width, docked to the bottom, black header bar (the overlay rule) with a 44px close.

2. Bodies are left-aligned at 14px; sections are labels on a hairline rule.

3. The footer is pinned to the sheet: back (1px) on the left, the main action (2px) filling the rest, both 44px.

4. Danger keeps only the 3px rule and a ! heading, not a second black block. Destructive buttons get the 3px frame.

5. Wizard progress is numbered squares, current inverted; choices are 1px radio rows.

6. Ticks become [x] / [ ] text-mode boxes; on/off settings (fixed cost) use the switch.

Play: categories (tap a row, flip fixed cost) and the wizard (pick a choice).

Modals on wide screens

Centred 450px box in a 2px frame over the scrim, not a sheet. Same parts as phones: black header bar with a 44px ×, left-aligned body with section labels, footer with a 1px rule above.

The footer is right-aligned here (close · done), and buttons are 40px. Log actions, the budget wizard and import follow the same frame; the wizard keeps its numbered steps.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
