# KnickKnack

A found or gifted thing from the budget buddy: pixel art, a name, and how rare it is.

- Art is the catalogue's 32×32 grid drawn as ink pixels (`crispEdges`) at whole multiples: 40–44 on shelves, 64 in the drawer grid, 96 in a reveal, 128 in details. It takes `currentColor`, so every theme recolours it.
- Tile: `sheet`, 1px frame, art, name, `×n` top right.
- **Rarity** (`.Rarity`) climbs by line weight, never inversion: everyday dotted · uncommon 1px · rare 2px · unique and special 2px + `shadow-float` + `star`.
- `--disabled` in giving mode (achievement items stay with whoever earned them): dotted, `opacity-disabled`, a tooltip. `--wrapped` for a gift not opened yet: dotted, full strength.

**Consumer provides:** the item id (art and name come from the catalogue), the count, the state.
