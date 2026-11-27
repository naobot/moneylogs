# LogsMenu

The group page's sidebar: one framed, right-aligned item per view (summary, then each member), draggable to reorder.

- Active and hovered items invert. A loading member is a pulsing skeleton bar in an inert frame.
- Below `bp-md` it becomes a horizontal, scrolling strip at 0.6em; the subtitle hides below `bp-sm`.
- The drag handle is `ink-faint` and only appears where drag-to-reorder is enabled (not on touch).

**Consumer provides:** items (title, subtitle), the active id, reorder handler.
