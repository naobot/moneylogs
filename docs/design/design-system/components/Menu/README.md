# Menu

A dropdown of a few actions or choices, opened from a button: the caret menu, a log's or a friend's `⋯`, the home friends menu, the cheer presets.

- Floating layer: `paper`, `border-rule`, `shadow-float`. Rows are 44px on phones (36–40 on wide), split by 1px rules; a quiet list (cheer presets) uses dotted rules.
- The trigger (`.MenuTrigger`) inverts while the menu is open, and a caret flips.
- Rows can lead with an icon (`eye` display, `sun`/`star`/`moon` theme, `exit` sign out). A row that cycles in place (theme) leaves the menu open.
- Destructive rows (unfriend) open a confirm sheet; they never act straight away.

**Consumer provides:** rows (label, optional icon, handler), the trigger, an `aria-label`.
