# User states and flows

The seeded accounts are long-time users: Alice has "something in every state", which is
exactly why first-run problems slip past. This page lists the states a person can be in,
the accounts that put you in each one, and the flows to walk before a feature ships.
Each flow has an id (F1, F2…). Playwright walkthroughs will follow the same ids, so this
page is also their spec.

## Test accounts

Run `firebase emulators:start` (with the functions built), then `npm run seed-emulator`.
Every account's password is `test123`.

| Account                    | Stage                                                                                                       | Reset                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `fresh@test.com`           | Just signed up; `onboardingPending`, so every page sends them to `/welcome`; email unconfirmed              | `npm run reset-persona -- fresh`                       |
| `empty@test.com`           | Finished the wizard (Toronto, CAD); empty personal log; tour and Home nudge not seen yet; email unconfirmed | `npm run reset-persona -- empty`                       |
| `lapsed@test.com`          | Joined ~6 months ago (Sydney, AUD), logged three months, quiet since; this month is empty                   | `npm run reset-persona -- lapsed`                      |
| `alice.vancouver@test.com` | Long-time user with something in every state                                                                | restart the emulators and seed again                   |
| any new email              | Not an account yet: sign up through one of the invite links below                                           | (restart the emulators)                                |
| signed out                 | Spectator on a public log, landing pages                                                                    | sign out, or use a private window                      |
| guest                      | "Try without an account" on the landing page or `/login`, in a private window                               | sign out (confirms first), or close the private window |

`npm run reset-persona -- all` resets all three. Resetting deletes the account through the
real `deleteAccount` function, so whatever a persona did in someone else's log stays
behind as "deleted user", just as it would in production.

**Invite links** (the seed prints them; the friend code is fixed):

- friend: `http://localhost:5173/invite/alice-0001`
- social log: `/g/<roommates id>/invite` (Alice's ongoing log)
- financial log: `/l/<home id>/invite` (Alice + Bob's shared log)

**Device state.** Tips, theme and drafts live in the browser (`ML__*` keys), so a
browser you've used before hides first-visit behaviour. Open any page with
`?fresh-device` (dev only) to forget them while staying signed in, or use a private
window for a completely clean first visit.

## State dimensions

A screen can look different along each of these. When a feature touches one, check the
values in bold. Those are the ones that get missed.

| Dimension     | Values                                                                                                                                                                          | Where it lives                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account stage | signed out · **guest** (anonymous sign-in, no email yet) · **onboarding pending** · **just onboarded** · established · **lapsed**                                               | `isAnonymous` (Firebase Auth), `onboardingPending`, `tutorials.*`, `createdAt`, `logLastViewedAt`                                                                                                              |
| Email         | confirmed (all seeded users, `lapsed@`) · **unconfirmed** (`fresh@`, `empty@`): no friend requests, invite link, gifts or log invites · grandfathered (made before 23 Nov 2026) | Firebase Auth `emailVerified` + `metadata.creationTime` (`src/utils/confirmedEmail.ts`)                                                                                                                        |
| How they came | **direct sign-up** · **friend invite** · **log invite** · **ledger invite** · spectator link                                                                                    | `/invite/:code`, `/g/:id/invite`, `/l/:id/invite`, `?next=` through the wizard                                                                                                                                 |
| Content       | **nothing at all** · **personal log only** · one group log · many logs · archived logs                                                                                          | `groups`, `personalLedgerId`, ledgers `memberUids`                                                                                                                                                             |
| Social        | **no friends** · friends · pending requests · **no knick-knacks** · finds · **friends list hidden** (default) / shown · **left off others' lists**                              | `friendships`, `users/{id}/knickknacks`, `users.showFriends`, `users.hideFromFriendLists`, `friendLists/{id}`, `nudges`                                                                                        |
| This month    | **no entries yet** · under budget · near / over budget · **no budgets set**                                                                                                     | ledger `months/{YYYY-MM}`, category budgets                                                                                                                                                                    |
| Past budgets  | **never edited** (past months use today's budgets) · edited (months up to the edit keep their own)                                                                              | ledger `budgetSnapshots/{YYYY-MM}`                                                                                                                                                                             |
| Scheduled     | **none** (a fixed category shows only `[+ scheduled payment]` and its help) · own · someone else's (shared log, read-only) · paused                                             | ledger `schedules/{id}` (`nextDue`/`nextDueAt` server-only), entries `scheduleId`, `scheduled_logged` notifications                                                                                            |
| Sublogs       | **none** · parent · sublog · **shared sublog with members outside the parent** · unlinked (past months frozen) · **intro not seen**                                             | `sublogLinks/{linkId}` (server-only), ledger `parentLink` and category `sublog` (link id only), parent `hasRollups` and `rollups/{YYYY-MM}__{linkId}`, `tutorials.sublogIntro`, `sublog_counted` notifications |
| Month review  | outside the 1st–3rd · **due** · snoozed · reviewing (card on last month's stats) · done / dismissed · **last month empty** (never asked)                                        | `users/{id}/monthReviews/{ledgerId}_{YYYY-MM}`, `ML__buddy_review_{ledgerId}` (opened by itself today)                                                                                                         |
| Device        | **first visit** · returning · stored theme / dismissed tips / stats category sort / friends order (**none**: list waits for the server)                                         | `ML__*` keys in browser storage (e.g. `ML__stats_category_sort`, `ML__friends_order_{uid}`)                                                                                                                    |
| Push          | **web (no push)** · native, push off (default) · push on · **blocked in phone settings** · evening reminder on (default) / off                                                  | `users/{id}/devices/{installId}`, `ML__pushOn`, `users.checkInReminder`, `users.checkInReminderDueAt` (server-booked), buddy `streak.lastDay` / `remindedDay` (server-only)                                    |
| Presentation  | phone width · desktop · **night shift** · **native app (Capacitor)** · **mono charts** (default: theme chart colours)                                                           | `data-theme`, `data-charts` (`ML__display.charts`), `isNative()`                                                                                                                                               |

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

### F1b. Trying it as a guest, then saving the account

As: a private window, signed out.

- "Try without an account" (landing hero, and below the forms on `/login`) goes to `/welcome`; the wizard and
  personal log work as for a new account. Invited visitors (an invite landing, or `/login` on the way to an
  invite) aren't offered it.
- Home shows the guest banner above everything; `/me#account` shows the save form and sign out, no email,
  password or delete actions.
- Add friend, the invite link, gifts and inviting friends into a log open "save your account" with the form.
- Opening an invite link (friend, social log, financial log) shows "save your account to accept" instead.
- Signing out asks first, saying everything they've logged will be lost.
- Back on `/login` (e.g. through the browser history) a guest sees the save form, "keep going as a guest",
  and "sign in to another account" (through the sign-out warning), never the sign-in forms. Starting as a
  guest again reuses the same guest and user doc. Guests can't join someone else's social log (rules).
- Saving from the create wizard's friends step reloads the page; the half-made log comes back
  (`ML__create_log_draft`, for an hour, dropped once read or once the log is created).
- On an invite page signed out, the header's "Sign in" carries the invite along like the page's own buttons,
  so guest mode isn't offered there either.
- A guest idle for 30+ days is removed by the daily cleanup (`functions/src/accountCleanup.ts`), as is an
  account whose email was never confirmed, idle 30+ days, with no friendships, requests or shared logs.
  `/admin` → account cleanup previews who that would be.
- Saving with an email that already has an account says so and keeps them a guest. Saving with a new one
  reloads as a normal, unconfirmed account (the banner's gone, same logs), and the confirmation email arrives.

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
- With push on, the evening reminder stops once their last check-in is over a week old, and resumes after their next visit.

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

### F6c2. Confirming an email before reaching out

As: `empty@test.com` (unconfirmed), with Alice signed in in another window.

- On Alice's profile, "Add friend" opens "confirm your email" instead of sending; nothing reaches Alice.
- `/me#friends` shows "Confirm your email address to get your invite link" and a "confirm email"
  button instead of the link. Gifting and inviting friends into a log ask the same way.
- Answering a friend request, opening someone's invite link and joining a log from its invite page
  all still work unconfirmed.
- "Resend link" sends a new email (the Auth emulator prints the link in its log). Open it, then
  "I've confirmed" closes the modal, and the invite link appears without a reload.

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

### F6e. Sublogs

As: Alice (seeded with "business" and "bali 2026" as sublogs of her personal log; Bob is in the trip but not
in her personal log), then Bob, then a new-user persona for the first-run case.

- Personal: stats show **business** and **bali** with the box-in-box mark and "↳ name ›"; the strip, budget and
  charts include them; last month includes business too (it was linked for all months). The entries view has a
  "↳ business · N entries" row on each day it had spending, counted in the day's subtotal, and the add form
  doesn't offer the linked categories (a hint links to them instead).
- Bali: the line under the title says her spending counts as bali in personal. Only Alice's USD 420 counts,
  not Bob's USD 380. As Bob, the same line doesn't name her personal log, and his entries stay out.
- Home: business and bali hang under personal on a tree line; as Bob, bali is a card of its own.
- The intro ("what's a sublog?") opens by itself once, on Home, for anyone who has logged before (in a log
  besides their personal one, or an entry in it). As `empty@test.com` it waits until after their first entry.
  If they reach sublogs another way first, it opens instead on the wizard's "part of another log?" step,
  over the Manage link form, or on first visit to a sublog or parent (after the ledger tour). Its link
  replays it.
- Link a log from Manage (try "all its months", and a shared parent: others in both logs get a "your spending
  now counts" notice), then unlink it: past months keep their totals and the line becomes an ordinary category.
  Deleting a sublog keeps the parent's history the same way.
- Empty case: a new persona's wizard step lists only "no, it stands alone" and their personal log; a log with
  no sublogs shows none of this and makes no extra queries.

### F6f. Pulling spending into a post

As: Alice (in a group log, with entries today in more than one of her financial logs and in two currencies),
then `empty@test.com`.

- In the post editor, "pull from logs" lists only Alice's own entries on the post's day, grouped by log, all
  ticked. Other members' entries in a shared log never show. ‹ › steps the day.
- Untick one log, add the rest: a bold line per log and a list line per entry are appended to the post, and
  the totals are added to the amount rows (a new row per new currency; a lone untouched 0 row is replaced).
  The post then shows each currency ("1,700 JPY · 12.5 CAD") and so do the day and week banners.
- Reopen the picker: entries already in one of her posts in this log are unticked and marked "already in a post",
  including posts far enough back that the page hasn't loaded them.
- Edit the pulled lines and the amount rows freely; nothing links back to the ledger. The row calculator reads
  the pulled "- ramen · food — 1,200 JPY" form, counting only the amount after the em dash.
- Close the editor before posting and reopen it: the text, amount rows and pulled marks come back together.
  Sign out, or sign in as someone else on the same browser: the unsent draft is gone.
- Empty case: a fresh persona has a personal log, so the button shows, and the picker says "nothing logged in
  your logs on this day". Someone with no financial logs at all sees no button.

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
