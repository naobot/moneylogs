# User states and flows

The seeded accounts are long-time users: Alice has "something in every state", which is
exactly why first-run problems slip past. This page lists the states a person can be in,
the accounts that put you in each one, and the flows to walk before a feature ships.
Each flow has an id (F1, F2…). Playwright walkthroughs will follow the same ids, so this
page is also their spec.

## Test accounts

Run `firebase emulators:start` (with the functions built), then `npm run seed-emulator`.
Every account's password is `test123`.

| Account                    | Stage                                                                                     | Reset                                |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| `fresh@test.com`           | Just signed up; `onboardingPending`, so every page sends them to `/welcome`               | `npm run reset-persona -- fresh`     |
| `empty@test.com`           | Finished the wizard (Toronto, CAD); empty personal log; tour and Home nudge not seen yet  | `npm run reset-persona -- empty`     |
| `lapsed@test.com`          | Joined ~6 months ago (Sydney, AUD), logged three months, quiet since; this month is empty | `npm run reset-persona -- lapsed`    |
| `alice.vancouver@test.com` | Long-time user with something in every state                                              | restart the emulators and seed again |
| any new email              | Not an account yet: sign up through one of the invite links below                         | (restart the emulators)              |
| signed out                 | Spectator on a public log, landing pages                                                  | sign out, or use a private window    |

`npm run reset-persona -- all` resets all three. Resetting deletes the account through the
real `deleteAccount` function, so whatever a persona did in someone else's log stays
behind as "deleted user", just as it would in production.

**Invite links** (the seed prints them; the friend code is fixed):

- friend: `http://localhost:5173/invite/alice-0001`
- social log: `/g/<roommates id>/invite` (Alice's ongoing log)
- financial log: `/l/<home id>/invite` (Alice + Bob's shared log)

**Device state.** Tips, drawers, theme and drafts live in the browser (`ML__*` keys), so a
browser you've used before hides first-visit behaviour. Open any page with
`?fresh-device` (dev only) to forget them while staying signed in, or use a private
window for a completely clean first visit.

## State dimensions

A screen can look different along each of these. When a feature touches one, check the
values in bold. Those are the ones that get missed.

| Dimension     | Values                                                                                       | Where it lives                                                                 |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Account stage | signed out · **onboarding pending** · **just onboarded** · established · **lapsed**          | `onboardingPending`, `tutorials.*`, `createdAt`, `logLastViewedAt`             |
| How they came | **direct sign-up** · **friend invite** · **log invite** · **ledger invite** · spectator link | `/invite/:code`, `/g/:id/invite`, `/l/:id/invite`, `?next=` through the wizard |
| Content       | **nothing at all** · **personal log only** · one group log · many logs · archived logs       | `groups`, `personalLedgerId`, ledgers `memberUids`                             |
| Social        | **no friends** · friends · pending requests · **no knick-knacks** · finds                    | `friendships`, `users/{id}/knickknacks`                                        |
| This month    | **no entries yet** · under budget · near / over budget · **no budgets set**                  | ledger `months/{YYYY-MM}`, category budgets                                    |
| Device        | **first visit** · returning · stored theme / drawers / dismissed tips                        | `ML__*` keys in browser storage                                                |
| Presentation  | phone width · desktop · **night shift** · **native app (Capacitor)**                         | `data-theme`, `isNative()`                                                     |

## Flows

For each flow: the accounts to walk it as, and the things to look for besides "it works".
On every screen, check it at phone width and in night shift.

### F1. Sign up → welcome wizard → Home

As: a new email from `/login`, then `fresh@test.com` (opening any page should land on `/welcome`).

- Every wizard step (name, location, display, currency) can go back and forward; a reload mid-wizard resumes at the right step.
- Location: city search sets the timezone; skipping the city still lets them continue.
- After the last step they land on Home, not on `/welcome` again, and no "set your default currency" prompt appears.
- The personal log exists, in the currency they picked.
- Nothing on Home assumes they have logs, friends or finds: look at every empty drawer and section.

### F2. First visit to the personal log (tour)

As: `empty@test.com` with `?fresh-device`.

- Home shows the nudge toward the personal log; following or dismissing it hides it on another device too.
- The tour runs once on the empty personal log, can be skipped, and doesn't return after a reload.
- First entry: the new-entry tip and editor tips run in order; the empty month, budget and stats views make sense before and after it.

### F3. Signing up through an invite

As: a new email through each invite link (friend, social log, ledger), signed out first.

- The landing page explains what they were invited to, and the sign-up bar keeps the invite through sign-up.
- The wizard carries `?next=` and ends on the invite, not on Home.
- Friend invite: Alice becomes a friend straight away; both see it. Log invites: they join the log and it shows on Home.
- Repeat as `empty@test.com` (an existing account opening the link) and as Alice (her own link).

### F4. First group log

As: `empty@test.com`.

- Create a social log from `/create`; check the empty log page before the first post.
- First post, first comment, first reaction: tips, empty states and the notification inbox.
- Joining someone else's log (via F3's link) as someone with no other logs.

### F5. Returning after a long gap

As: `lapsed@test.com`.

- Home and the personal log open on the current, empty month without errors or misleading "over budget" leftovers.
- Old months, stats and the buddy still make sense; no tour or nudge reappears.
- Nothing that counts "since your last visit" overflows or reads oddly after months.

### F6. Spectator and signed out

As: signed out, in a private window.

- `/g/:id` for a public log, every landing page, `/about`, `/privacy`.
- Every action that needs an account leads to sign-in and back to where they were.

### F7. Leaving

As: any persona (then reset it).

- Deleting the account from `/me` signs them out cleanly; their posts in shared logs show as "deleted user".

## Before shipping a feature

- [ ] Which dimensions above does it touch? Say so in the PR description.
- [ ] Walk the flows that cross it as the new-user personas, not only as Alice.
- [ ] Empty states: what does it show with nothing at all, and with exactly one item?
- [ ] First visit on this device (`?fresh-device`), phone width, night shift.
- [ ] If it adds a new user field or `ML__` key, add it to the state dimensions table.
