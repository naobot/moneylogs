# Bubble

A speech bubble for someone talking: the budget buddy's lines, a friend's nudge, the found line on a knick-knack.

- `sheet`, 1px, `radius-bubble`, and always a tail aimed at the speaker: `--up` under the buddy or an avatar, `--left` beside a face (16px gap). No shadow: the tail does the lifting.
- The buddy's bubble can hold actions: one main button (let's look) and quiet `TextButton`s (ask me tomorrow · not this month).
- **NudgeBadge:** a bold `!` on a filled ink square, no rounding, on an avatar's corner or beside the buddy when something is waiting. It bounces gently (`.bounce`), not under reduced motion. Tap it to open the bubble.

**Consumer provides:** the text (in the speaker's own case), the tail side, optional actions.
