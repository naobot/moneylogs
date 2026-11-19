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

| Dimension     | Values                                                                                                                                             | Where it lives                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Account stage | signed out · **onboarding pending** · **just onboarded** · established · **lapsed**                                                                | `onboardingPending`, `tutorials.*`, `createdAt`, `logLastViewedAt`                                                      |
| How they came | **direct sign-up** · **friend invite** · **log invite** · **ledger invite** · spectator link                                                       | `/invite/:code`, `/g/:id/invite`, `/l/:id/invite`, `?next=` through the wizard                                          |
| Content       | **nothing at all** · **personal log only** · one group log · many logs · archived logs                                                             | `groups`, `personalLedgerId`, ledgers `memberUids`                                                                      |
| Social        | **no friends** · friends · pending requests · **no knick-knacks** · finds · **friends list hidden** (default) / shown · **left off others' lists** | `friendships`, `users/{id}/knickknacks`, `users.showFriends`, `users.hideFromFriendLists`, `friendLists/{id}`, `nudges` |
| This month    | **no entries yet** · under budget · near / over budget · **no budgets set**                                                                        | ledger `months/{YYYY-MM}`, category budgets                                                                             |
| Past budgets  | **never edited** (past months use today's budgets) · edited (months up to the edit keep their own)                                                 | ledger `budgetSnapshots/{YYYY-MM}`                                                                                      |
| Month review  | outside the 1st–3rd · **due** · snoozed · reviewing (card on last month's stats) · done / dismissed · **last month empty** (never asked)           | `users/{id}/monthReviews/{ledgerId}_{YYYY-MM}`, `ML__buddy_review_{ledgerId}` (opened by itself today)                  |
| Device        | **first visit** · returning · stored theme / drawers / dismissed tips                                                                              | `ML__*` keys in browser storage                                                                                         |
| Presentation  | phone width · desktop · **night shift** · **native app (Capacitor)**                                                                               | `data-theme`, `isNative()`                                                                                              |

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
- On the 1st–3rd after an empty month the buddy doesn't offer a month review; it only asks when last month had entries.
- Nothing that counts "since your last visit" overflows or reads oddly after months.

### F6. Spectator and signed out

As: signed out, in a private window.

- `/g/:id` for a public log, every landing page, `/about`, `/privacy`.
- Every action that needs an account leads to sign-in and back to where they were.

### F6b. Friends on a profile

As: two personas who are friends (the seed's Alice and one of hers), signed in in two windows.

- By default `/u/:id` shows no friends section to others; the owner sees "hidden from others" with a link to `/me#friends`.
- Switching on "Show my friends list on my profile" makes avatars (no names) appear on the profile for others, live; hovering one opens the peek.
- The friend switching off "Appear in other people's friends lists" drops out of that list; switching it back puts them back.
- A shown list with no friends reads "no friends to show yet".

### F6c. Inviting friends into a log

As: two personas who are friends (the seed's Alice and one of hers), signed in in two windows.

- In `/create`, a log with room for more than one person gets an optional "Friends" step before Review; a
  log for just you skips it. Review lists how many friends will be invited.
- In a log's invite modal (social and financial), friends already in the log aren't listed; ticking stops at
  the spots left; sent friends show "invited".
- The friend gets "X invited you to Y" in their inbox (and push, and the daily email by default); it opens
  the log's join page, and joining removes the invite from their inbox.
- With no friends (e.g. `empty@test.com`), the step and the modal say so and link to `/me#friends`; the
  share link still works as before.

### F6d. Pokes and cheers

As: two personas who are friends (the seed's Alice and one of hers), signed in in two windows.

- On Home, tapping a friend opens a menu: poke, cheer ▾ (preset words), profile →. Their profile has the
  same poke / cheer beside "Send a gift".
- Mashing poke shows "poked ×N" and sends one write a moment after the last tap.
- The friend's Home shows a bouncing "!" over the sender's avatar, live, and the sender moves to the
  front of the list. Tapping "!" opens a speech bubble ("poked you ×N · <cheer>"); closing it deletes it.
  No inbox entry, push or email.
- Unfriending clears anything waiting either way; unread ones expire after 14 days.
- With no friends there's nothing to show: the list's empty state is unchanged.

### F7. Leaving

As: any persona (then reset it).

- Deleting the account from `/me` signs them out cleanly; their posts in shared logs show as "deleted user".

## Walkthroughs (Playwright)

`npm run e2e` walks the automated flows in headless Chromium: F1 and F3 so far, in
`e2e/F<n>-*.e2e.ts`. Each one runs on a phone-sized screen, once in each ink (day and
night shift), and takes a screenshot at every step. When it finishes, open
`e2e/.output/index.html` to review all the steps side by side. The page also lists any
console errors. A green run only proves the flow completes; the screenshots are where
UX problems show up.

- Needs the emulators running with the functions built. It seeds them if they're empty and
  starts its own dev server on :5174, forced onto the emulators.
- Every request outside localhost is dropped, and any attempt to reach production Firebase
  fails the walkthrough. So does an uncaught error on the page.
- Accounts a walkthrough signs up are deleted afterwards, so runs don't fill Alice's logs.
- A flow that fails on a known bug is marked `it.fails` with a comment. Once the bug is
  fixed it turns red, as a reminder to drop the marker.
- To add a flow, copy one of the specs: `openWalkthrough("F4a-…", title, variant)`,
  `w.step("name")` at each screen, `w.done()` at the end. The shared steps (sign up, sign in,
  the wizard) are in `e2e/support/flows.ts`.

## Before shipping a feature

- [ ] Which dimensions above does it touch? Say so in the PR description.
- [ ] Walk the flows that cross it as the new-user personas, not only as Alice: `npm run e2e`
      for the automated ones, by hand for the rest.
- [ ] Empty states: what does it show with nothing at all, and with exactly one item?
- [ ] First visit on this device (`?fresh-device`), phone width, night shift.
- [ ] If it adds a new user field or `ML__` key, add it to the state dimensions table.
