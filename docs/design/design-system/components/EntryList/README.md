# EntryList

The financial ledger: entries grouped by day, one row per entry.

**(2026-11)**

- **Day headers:** today's is a black bar (`today · thu 26 nov` · the day's total), once per list; every earlier day is a section label on a 1px rule. No more inverted strip per day.
- **Rows:** on the ground, no frame, split by `ink-faint` dashes (dashed = editable items). Bold category · note in `ink-muted` · bold right-aligned tabular amount. Phones: the note drops to a second line and the row's actions sit behind one 44px `⋯`; rows are at least 44px. Desktop: actions are icon buttons (pencil, bin) shown on hover, the hovered row on `sheet` with a hairline outline.
  **Consumer provides:** entries grouped by day, each with category, note, amount and currency.
