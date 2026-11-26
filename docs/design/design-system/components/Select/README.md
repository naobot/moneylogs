# Select

**(2026-11)** One of many options. Solid frame: **you choose**, not type.

- **Boxed:** a real `<select>` with `appearance: none` inside a 44px `border-hairline` frame on `sheet`, with a 40px `▾` cell split off by the frame's line. Open / pressed: 2px frame, the `▾` cell inverted (`▴`). Empty: the prompt in `ink-muted`.
- **Inline:** in headers and rows (`JPY ▾`, `inbox only ▾`): bold text on a 1px solid underline, 44px hit area.
- Phones keep the OS picker; only the closed control is drawn.
- **Listbox** for long or searchable lists (currency, place picker): a container with a `>` search line on top, 44px options split by faint dashes, the chosen one inverted. `CustomDropdown` becomes this.
