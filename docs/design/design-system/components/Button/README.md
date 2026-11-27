# Button

The app's one button: a square box whose label is set in bold caps-lock, inverting on hover.

**Consumer provides:** `text` (sentence case — CSS uppercases it), `onClick` or `to` (renders a router `Link`), optional `icon`, `size` (`xs`–`xl`, default `md`), `buttonStyle`, `isSelected`, `disabled` / `loading`.

**Styles**

- `primary-border` (2px `border-rule`, bold) — the default for any committed action: Save, Submit, Join.
- `primary-border-lite` (1px `border-hairline`) — the secondary action beside it: Cancel, Back, Nevermind.
- `primary` (no frame) — icon actions inside dense rows, e.g. the nav's icon items.
- `--active` (`isSelected`) — the current choice in a segmented set. Inverted and inert.
- `--past` — a dotted frame for a log that has ended.
- `--nav` — log titles in the main nav keep their own case and size.
- `--inverse` — the one highlighted action on a page (Sign out). Flips back to paper on hover. Use once per screen.

**Do:** pair `primary-border` with `primary-border-lite`; keep labels to one or two verbs.
**Don't:** round the corners, colour the fill, or use opacity below `opacity-disabled` to mean anything but disabled.

Hand-written from `src/components/Button.tsx` and `.Button` in `src/App.scss`.
