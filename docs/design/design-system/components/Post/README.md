# Post

A log post: a hairline-framed `sheet` with a three-column header (author · amount · time), markdown body and footer.

- **Pinned** posts invert and shrink to 0.8em; they sort first.
- **Selected** (being edited) thickens to `border-rule` and floats above the scrim (`z-selected`).
- Images inside a post get a hairline frame with a 5px paper inset — a printed-photo border.

**Consumer provides:** author, amount + currency, local time, markdown body, comment count.
Hand-written from `.LogPosts__posts__item`.
