# Field

Text inputs. **Dashed means you type; it turns solid while focused.**

- **Text field (2026-11):** for forms. Label above in caption, never a placeholder standing in for it; a 44px box with a dashed `border-hairline` frame on `sheet`. Focus: 2px solid plus the focus ring. Error: `border-heavy` and a `!` message in caption under the box. Disabled: `opacity-disabled`.
- **`LineInput`:** inline, in-place editing (a title, a note, a quick rename): a dashed underline that turns solid on focus.
- **Text area (2026-11):** the same dashed frame; grows from 3 to 8 rows, then scrolls; no resize handle. A footer strip inside the frame says "markdown ok" and counts characters. The post editor puts a toolbar of 40×36 glyph buttons (B, I, •, [↗], [▣]) on top, pressed ones inverted.
- **Amount (2026-11):** a text field with the currency as a solid prefix cell (`JPY ▾`); the number bold, right-aligned, tabular.

**Consumer provides:** a visible label, `aria-invalid` and an error string when invalid.
