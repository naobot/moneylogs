# Check

**(2026-11)** Text-mode checkboxes and radios. The mark is decoration; a visually hidden native input keeps keyboard, screen-reader and form behaviour.

- **Checkbox** `[ ]` / `[x]`: choosing some items from a list (import rows, friends to invite). 44px rows split by faint dashes. Checked rows don't invert.
- **Radio rows** `( )` / `(•)`: one of a few answers that each need a sentence (the budget wizard's saving styles). Stacked rows in 1px frames that share their lines; the chosen row inverts. Replaces `ChoiceCard` for these.

For on/off settings use a Switch; for short options, Segmented.
