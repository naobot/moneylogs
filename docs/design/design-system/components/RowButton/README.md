# RowButton

A tiny hairline-framed action that sits at the end of a list row or beside a stepper.

Consolidates near-identical copies in the code: `.LogRowButton` (logActions), `.CategoryManager__rowButton` and `.Ledger__month__step` / `__today` (ledger). One class, one size (0.75em, caps-lock), plus `--glyph` for `‹ ›` / `↑ ↓` / `×` symbols, which skip the caps-lock and get snugger padding.

**Consumer provides:** a short verb label, or a single glyph with `glyph` and an `aria-label`. In code: `<RowButton>` from `src/components/RowButton.tsx`.
**Use** inside lists, toolbars and month steppers. **Don't** use it as a page's primary action — that is `Button`.
