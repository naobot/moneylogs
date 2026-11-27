# moneylogs design handoff

Everything Claude Code (or anyone) needs to implement the November 2026 UI audit.

- `PLAN.md`: the order of work, one PR at a time. **Start here.**
- `design-system/`: the rulebook, exported from the "moneylogs" design system.
  - `README.md` is the brand book: principles, colour, type, surfaces, frames and line styles, inversion budget, action weight, floating layer, notices, knick-knacks, layout, controls, motion, iconography.
  - `tokens.json` holds every token, `clean-up.md` lists the values in `src/` to retire, and `components/<Name>/README.md` + `preview.html` are the guidelines and a static rendering for each component, styled by `components/bundle.css`.
- `screens/`: one spec per audit screen (S1–S14) with the review decisions, the canvas notes and a "done when" list.
- `boards/`: the canvas artboards (`*.dc.html`) as markup reference: exact sizes, spacing and copy. They won't run outside the canvas; read them, don't serve them.
- `icons.md`: maps the `/_blob/<id>` icon references in boards and previews to the files in `public/icons/`.

Live sources (newer than this export if they disagree):

- Canvas: https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5
- Design system: https://claude.ai/artifact/VhXG5BsaeEsmeNUmiAKQk3

Precedence when things disagree: a screen spec's "Decisions made in review" > the design-system README > the canvas notes > the board markup.

Exported 27 Nov 2026.
