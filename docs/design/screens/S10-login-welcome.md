# S10 login + welcome

Source: the "moneylogs — small-screen UI audit" canvas (https://claude.ai/artifact/HmijpeUWFqhEpwjeG7nkh5). Boards are exported in `../boards/` as markup reference.

## Boards

- `boards/Login.dc.html` — S10 · log in / register
- `boards/WelcomeName.dc.html` — S10 · welcome: name
- `boards/WelcomeLocation.dc.html` — S10 · welcome: location

## Decisions made in review (these win over the notes below)

- Keep the app's own copy ("I'm a new user", "try without an account").

## Canvas notes

Login + welcome · what's busy

1. Everything sits in a Window, with 2em gaps between every block.

2. The [?] about link is 0.2em of the wordmark: about 8px on a phone.

3. "I'm a new user" / "I have an account" are two separate toggle buttons, ~28px.

4. Fields are label-left ControlledInputs that stack on phones; password rules appear as error text.

5. The guest option is set off by a centred 1px rule with muted copy.

6. The welcome wizard has the same faded progress and scrolling back / next as the create wizard; its display step embeds the whole display settings page.

What changed

1. Login has no Window: the wordmark at 40px with the one-line pitch from the landing page, and [?] what is this as a 12px caps link.

2. One joined 2px toggle (I'm a new user | I have an account). Press Play and switch: the button and the password hint change.

3. Boxed 44px fields; register shows what the password still needs under the field, in caption.

4. just looking? is a section label at the bottom, with a secondary try without an account.

5. Welcome uses the wizard pattern from S9: title bar, step squares, 18px question, pinned back / next. Location uses the searchable listbox.

## Done when

- Matches the boards at 390px and, where there's a wide board, at 1440px (and 1024px for the financial log).
- Passes the per-screen checklist in `00-foundations.md`.
- Uses only design-system tokens; anything retired in `design-system/clean-up.md` that it touches is replaced.
- Visual test added or refreshed for the screen.
