# Loader

Three ways to say "working": the framed progress bar (page loads, uploads), the blinking ellipsis (inline waits), and pulsing skeleton bars (rows streaming in).

- Bar: hairline frame, 3px inset, solid `ink` fill animating its width over 1s.
- Blink: `steps(1)` so it snaps like a cursor, never fades.
- Skeleton: solid `ink` pulsing 0.12 ↔ 0.3 over 1.2s.

Any async action longer than ~300ms shows one of these.
