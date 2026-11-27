# Modal

A dialog portalled into `#modal-root`. **(2026-11)** On phones it is a **bottom sheet**: full width, docked to the bottom over the `scrim`, at most ~90% of the screen tall. From `bp-md` up it is a centred box, max `modal-width` (450px), in a `border-rule` frame. The share card box is the one exception, 640px, so its preview and options sit side by side.

**Parts:**

- **Header:** a black bar (`inverse-surface`) — the overlay rule — with the lowercase title at 14px and a 44px `×` close. The striped `TitleBar--striped` variant is retired: striped means a page's own header.
- **Body:** left-aligned, 14px on phones; sections are section labels on a 1px rule, not boxes.
- **Footer:** pinned to the bottom of the sheet with a 1px rule above. Back / cancel (1px) on the left; the main action (2px; 3px when destructive) fills the rest. Both 44px tall.

**Consumer provides:** title, body, footer actions, `onClose`; `disabled` blocks closing while a mutation runs.
**Don't** put a second black block inside (the danger heading is a `!` label now).
