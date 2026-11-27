# Icon

Pixel-art SVG icons rendered as `<img>` from `/icons/<artist>-<name>.svg`; 29 in the set: 19 from the Noun Project and ten drawn in-house (`moneylogs-`).

**Consumer provides:** `type` (one of the `IconType` names), optional `size` (default 24; inline `.Icon` is 21px), `fill="white"` on dark grounds.

- On `inverse-surface`, and everywhere in Night shift, add `.Icon--inverse` (an invert filter) — `<img>` cannot inherit colour.
- Pair with text via `IconText`; the icon sits 5px below centre to share the text baseline.
- An icon alone needs an `aria-label` on its button.
