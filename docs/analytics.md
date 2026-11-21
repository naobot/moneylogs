# Usage analytics

Aggregate usage goes to Google Analytics 4 through Firebase Analytics (web only; the
native apps send nothing). The point is "how much is each page and action used", not
what any one person did, so events never carry user, log, post or comment ids, names,
amounts or free text.

- `src/utils/analytics.ts` — `track(event, params)`, the typed list of every event
  (`AnalyticsEvents`), and the route patterns used for page views (`PAGE_ROUTES`).
- `src/hooks/usePageViewTracking.ts` — one `page_view` per route change, mounted in `App.tsx`.
- `src/config/firebase-config.ts` — turns off gtag's own page view; non-production
  builds (PR previews, local) are sent with `debug_mode`, so they show in **DebugView**
  but never in the reports.

## Adding an event

1. Add it to `AnalyticsEvents` with its params (low-cardinality only: a kind, a source,
   a count, a boolean).
2. Call `track("my_event", { ... })` after the action succeeds.
3. If it has a new param, register it as a custom dimension (below).

## Events

| Event                   | When                                     | Params                                                                                                                                 |
| ----------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `page_view`             | Route change (pathname only)             | `page_path` (pattern), `page_title`, `signed_in`                                                                                       |
| `sign_up`               | Account created                          | `method`                                                                                                                               |
| `login`                 | Signed in from the login form            | `method`                                                                                                                               |
| `tutorial_complete`     | Welcome wizard, ledger tour, first post  | `tutorial`                                                                                                                             |
| `create_log`            | Create wizard finished                   | `log_kind`, `invited_friends`                                                                                                          |
| `join_log`              | Joined from an invite page               | `log_kind`                                                                                                                             |
| `archive_log`           | Archived / unarchived                    | `log_kind`, `archived`                                                                                                                 |
| `delete_log`            | Deleted                                  | `log_kind`                                                                                                                             |
| `invite_friends_to_log` | Invites sent from the invite modal       | `log_kind`, `invited_friends`                                                                                                          |
| `add_post`              | New post in a social log                 | `travelling`                                                                                                                           |
| `open_comments`         | A post's comments opened                 | `has_comments`                                                                                                                         |
| `add_comment`           | Comment added                            | —                                                                                                                                      |
| `add_reaction`          | Reaction added                           | —                                                                                                                                      |
| `add_entry`             | Entry added to a financial log           | `shared_log`, `has_note`                                                                                                               |
| `import_entries`        | CSV import finished                      | `source`, `created`                                                                                                                    |
| `no_spend_day`          | No-spend day confirmed                   | —                                                                                                                                      |
| `delete_category`       | Category deleted from a financial log    | —                                                                                                                                      |
| `remove_budget`         | A category's monthly budget removed      | —                                                                                                                                      |
| `monthly_total`         | A log's monthly total set or removed     | `action` (`set`, `remove`)                                                                                                             |
| `stats_period`          | Stats period switched in a ledger        | `period` (`month`, `quarter`, `year`)                                                                                                  |
| `stats_sort`            | Stats categories sorted differently      | `sort` (`order`, `amount`, `pace`)                                                                                                     |
| `month_review`          | Answer to the buddy's month-start review | `action` (`start`, `snooze`, `dismiss`, `adjust`, `keep`)                                                                              |
| `sublog_linked`         | A log linked as a sublog of another      | `from` (`wizard`, `log_actions`), `include_past`, `shared_parent`                                                                      |
| `sublog_unlinked`       | A sublog link ended                      | `from` (`sublog`, `parent`)                                                                                                            |
| `update_profile`        | Profile saved on /me                     | —                                                                                                                                      |
| `send_friend_request`   | Friend request sent                      | —                                                                                                                                      |
| `accept_friend`         | Friend request accepted                  | —                                                                                                                                      |
| `gift_knickknack`       | Knick-knack gifted                       | —                                                                                                                                      |
| `send_nudge`            | Poke or cheer sent to a friend           | `kind`                                                                                                                                 |
| `read_nudge`            | Received poke/cheer opened               | —                                                                                                                                      |
| `share`                 | Invite / profile link copied             | `method`, `content_type`                                                                                                               |
| `share_card`            | Share card shared or saved               | `card` (`daily`, `breakdown`), `format` (`story`, `square`), `result` (`shared`, `cancelled`, `downloaded`), `photos` (0–3), `amounts` |
| `chart_colours`         | Charts switched in /me Display           | `charts` (`colour`, `mono`)                                                                                                            |
| `open_drawer`           | A /me drawer opened                      | `drawer`                                                                                                                               |

`log_kind` is `social` or `financial`. Booleans arrive as `"true"` / `"false"`.

## One-time GA console setup

In the Firebase console → Analytics (or analytics.google.com, property for moneylogs-89ebf):

1. **Stop duplicate page views.** Admin → Data streams → the web stream → Enhanced
   measurement → ⚙ → Page views → _Show advanced settings_ → untick **Page changes based
   on browser history events**. (Leave the other enhanced measurements as you like.)
   Otherwise GA sends its own page view with the real URL (including ids) on every route
   change, alongside ours.
2. **Register custom dimensions.** Admin → Custom definitions → Create custom dimension,
   scope **Event**, one for each param below (dimension name can match the param):
   `log_kind`, `tutorial`, `archived`, `travelling`, `has_comments`, `shared_log`,
   `has_note`, `source`, `drawer`, `signed_in`, `period`, `action`, `kind`, `from`,
   `include_past`, `shared_parent`.
   And as custom **metrics** (unit: standard): `invited_friends`, `created`.
   `method` and `content_type` are built in. Dimensions only apply to data from the
   time they're created, not before.
3. **Mark key events** (optional). Admin → Events → star e.g. `sign_up`, `create_log`,
   `add_entry`, `add_post` so they show as key events in the overview.
4. **Check it works.** Open a PR preview: its events go to Admin → DebugView live
   (and stay out of the reports).

## Where to look

- **Reports → Engagement → Events**: count per event; click one to break it down by
  its params (e.g. `create_log` by `log_kind`).
- **Reports → Engagement → Pages and screens**: views per route pattern; switch the
  dimension to _Page path and screen class_ to see `/g/:groupId`, `/l/:ledgerId`, etc.
- **Explore → Funnel exploration**: e.g. `sign_up` → `tutorial_complete` (welcome) →
  `add_entry`, to see where new users drop off.
- Standard reports lag by up to a day; Realtime and DebugView are live.

Some web visitors block GA, so treat the numbers as trends, not exact counts.
