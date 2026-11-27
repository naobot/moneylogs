# Clean-up

Values found in the codebase that this system retires, and what replaces each. When touching a file that holds one, swap it.

**Status (27 Nov 2026, PLAN item 2):** everything in the Colours, Corners and shadows, and Type tables is done. Most of it was already fixed in `src/` before this export; item 2 did the rest. That was text faded below 0.7 (footer separators, upcoming wizard steps), the one-off sizes, an inline `#666`, and literal disabled/dragging opacities moved onto their tokens. The **Duplicated components** table is left to the component PRs (items 4–13). The breakpoints stay as Sass constants (`src/constants.scss`), because media queries can't read custom properties.

## Colours

| Found                             | Where                                                                                                                                    | Replace with                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `--c-white` `#f5f3f0`             | `App.scss` `:root`                                                                                                                       | `--paper`                                                       |
| `--c-black` `#242424`             | `App.scss` `:root`                                                                                                                       | `--ink`                                                         |
| `#fff` text on black              | pinned post, `.LogsSummary__bubble`, Snackbar, comment highlight, `.wmde-markdown` override                                              | `--inverse-ink`                                                 |
| `#e8e6e3`                         | `.Group__header` text                                                                                                                    | `--inverse-ink`                                                 |
| `#fff` surface                    | posts, `.EntryForm`, `.LedgerStats__panel`, `.PostPreview`, `.CustomDropdown__list`                                                      | `--sheet`                                                       |
| `#242424` literal                 | `.CustomDropdown__list` border                                                                                                           | `--ink`                                                         |
| `#f4f4f4`, `#ccc`, `#aaa`         | `.LogPost__images__skeleton`                                                                                                             | `--ink-ghost` fill, `--ink` dashed hairline, `--ink-muted` text |
| `var(--c-border)`                 | `.Snackbar__item--success .Snackbar__close`                                                                                              | **Undefined today** — use `--ink-muted`                         |
| `rgba(0,0,0,.2)`                  | modal and comment backdrops                                                                                                              | `--scrim`                                                       |
| `-webkit-focus-ring-color` (blue) | `index.css` `button:focus`                                                                                                               | 2px solid `--focus-ring`                                        |
| `opacity: .6` on text             | `.GroupArchive__empty`, `.Ledger__empty`, `.SpendingPanel__empty`, `.Drawer__hint`, list `small`s, `.AchievementsList__item__text span`… | `color: var(--ink-muted)` (0.6 gives 4.0:1 and fails AA)        |

## Corners and shadows

| Found                            | Where                                                                                                                                                                                                            | Replace with                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `border-radius: 1px … 5px`       | `.Button` 1px, `.Loader` 3px, `.Window` / `.Modal__content` / `.UpdateBanner` / `.TutorialTooltip` / chart tooltip / post images 4px, `.LogsSummary__bubble` 5px, `.PostPreview` / `.AchievementsList__item` 2px | `--radius-none`                                                                             |
| `6px 6px 0 0` / `10px`           | `.Tabs__tab` / `.LogPostComments__item`                                                                                                                                                                          | **Keep** — sanctioned exceptions. Swap the literals for `--radius-tab` / `--radius-bubble`. |
| `box-shadow: 0 2px 8px …`        | `.TutorialTooltip--center`                                                                                                                                                                                       | `border-rule` frame                                                                         |
| `stroke-linecap/linejoin: round` | `.SpendingChart__line`                                                                                                                                                                                           | `square` / `miter`                                                                          |

## Type

| Found                                                                                                                  | Replace with                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `font-family: Terminal, monospace` (`App.scss` `:root`, `.wmde-markdown`)                                              | `var(--font-mono)` (Hack, self-hosted)                                                                                       |
| `index.css` Vite boilerplate: `Inter`, `#242424` ground, `rgba(255,255,255,.87)` text, `button { border-radius: 8px }` | Delete the file's `:root`, `h1` and `button` blocks; `App.scss` already overrides them, but the blue focus ring still leaks. |
| Weights 500 (`TimezoneSetter`, tooltip, image skeleton) and 800 (week banner, modal close)                             | 400 or 700                                                                                                                   |
| One-off sizes 0.6rem, 0.72em, 0.78em, 0.82em                                                                           | the nearest of `micro` 0.7em · `caption` 0.8em · `small` 0.85em                                                              |

## Duplicated components

| Copies                                                                                                                                                   | Becomes                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `.LogRowButton`, `.CategoryManager__rowButton`, `.Ledger__month__step`, `.Ledger__month__today`                                                          | `RowButton`                             |
| `.LogActions__confirm input`, `.EntryForm__note`, `.CategoryManager__add input`, `.CategoryManager__budget__form input` (same dashed-underline rules ×4) | `LineInput`                             |
| `.Modal__header` + `.LedgerStats__strip` + `.EntryList__day__header` + `.Group__header` (inverted bars)                                                  | one `TitleBar` / inverted-strip pattern |
| `.LedgerStats__budget__track`/`__fill` and `.LedgerStats__shares__track`/`__fill`                                                                        | `Meter__track` / `Meter__fill`          |
| Breakpoints in `constants.scss` and `--sidebar-width` / `--main-width` in `:root`                                                                        | the `size` tokens                       |
