# Segmented

**(2026-11)** One joined control for one of 2–4 short, mutually exclusive options: segments share the frame and are split by its line; the active segment is inverted.

- **Primary choice** (entries | stats, digest | summary): `border-rule`, 40px, caps labels. On a log it sits flush under the title bar.
- **Sub-choice** (week | month | year, S M L, colour | mono): `border-hairline`, 36px.
- In settings, the label sits on the left and the control fills the rest of the row.

**Consumer provides:** the options, the selected id, an `aria-label` for the group.
**Use** something else for more than four options (a select) or for on/off (a switch). Two actions that aren't a choice (poke · cheer) look similar but are an ActionPair.
