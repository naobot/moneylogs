# Switch

**(2026-11)** A setting that is on or off and saves at once: colour charts, the daily email digest, a category's fixed cost. Replaces the native checkbox and `Button--toggle` in settings.

A square 52×26 track in a `border-rule` frame with an 18px square knob. On: track inverted, knob right. Off: paper track, ink knob left. Disabled: `opacity-disabled`. The whole row (label + switch, ≥ 44px) is the hit area; a hint in caption may follow.
Markup: `<button role="switch" aria-checked>` labelled by its row.
