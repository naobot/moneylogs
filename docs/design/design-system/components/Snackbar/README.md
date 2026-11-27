# Snackbar

A toast: a short sentence that floats in at the bottom (0.2s) after something happened, then can be closed.

**(2026-11)** It belongs to the floating layer: `paper`, `shadow-float`, a close `×`.

- **Success** (`Snackbar__item`): 2px frame and a `✓` mark. "Sent to mika: “proud of you”", "You're friends now".
- **Error** (`--error`): 3px frame and the `warning` icon, `role="alert"`. "Couldn't save that. Please try again."
- Phones stack toasts at the bottom, inside 12px; wide screens put them bottom-left, away from the buddy.
- No longer inverted: a black strip read as structure, and errors are said with weight, never colour.

**Consumer provides:** a one-sentence message, a variant, and the close handler.
