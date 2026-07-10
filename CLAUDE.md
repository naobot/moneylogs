# Project Overview

moneylogs (Firebase project ID: moneylogs-89ebf) is a web-based expense tracking app for group log sessions. The app is in active development following a successful first closed beta with a small group of friends, which yielded positive feedback and drove improvements to performance and UX. The core use case involves groups collaboratively logging spending across multiple currencies, with analytics surfaced after group sessions are archived.

Key architectural values: single source of truth, cost-effectiveness at current scale, and polished UX (e.g., progress indicators for async operations). The stack is Firebase-centric (Firestore, Firebase Storage, Cloud Functions v2, Firebase Hosting), with a React/TypeScript frontend using dayjs for date handling and custom hooks for Firestore mutations/queries. Backend errors are monitored via Sentry.

## Stack

| Layer           | Technology                                              |
| --------------- | ------------------------------------------------------- |
| Framework       | React 18 + TypeScript 5.6                               |
| Build / tooling | Vite+ (`vp`) — Rolldown, Vitest, Oxlint, Oxfmt          |
| Routing         | react-router-dom 7                                      |
| Backend         | Firebase (Auth, Firestore, Storage, Cloud Functions v2) |
| Styling         | Sass (`.scss`), co-located with components              |
| Editor          | `@uiw/react-md-editor` (markdown log posts)             |
| Drag & drop     | `@dnd-kit`                                              |
| Dates           | dayjs + `react-timezone-select`                         |
| Monitoring      | Sentry (`@sentry/react`, with session replay)           |
| Hosting / CI    | Firebase Hosting via GitHub Actions                     |

Node >= 24, npm >= 11. Path alias `@` → `./src`.

## Top-level layout

```
moneylogs/
├── src/                    # React application
├── functions/              # Firebase Cloud Functions (separate package)
├── public/                 # Static assets, custom SVG icon set
├── scripts/                # Emulator seeding, CORS setup, version stamping
├── .github/workflows/      # Firebase Hosting deploy (merge + PR preview)
├── firebase.json           # Hosting, Firestore, Storage, Functions, emulator ports
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Composite index definitions
├── storage.rules           # Cloud Storage security rules
├── vite.config.ts          # Build, lint, format, staged-file hooks
└── vitest.config.ts        # Test config (jsdom)
```

## `src/` — application code

Organized as a **feature-sliced** structure: cross-cutting primitives at the top level, domain code under
`features/`, and thin route entry points under `pages/`.

```
src/
├── main.tsx                # Entry: Sentry init, context providers, root render
├── App.tsx                 # Router, route table, CheckAuth guard, ErrorBoundary
│
├── pages/                  # Route entry points (one dir per route)
│   ├── home/               # /        — authed dashboard
│   ├── auth/               # /login   — login + registration
│   ├── create/             # /create  — new log group
│   ├── group/              # /g/:groupId and /g/:groupId/invite
│   ├── me/                 # /me      — user settings
│   └── about/              # /about
│
├── features/               # Domain logic, grouped by feature
│   ├── auth/               # Login, registration, password validation,
│   │                       #   error mapping, post-auth redirect
│   ├── layout/             # Layout shell, MainNav, Footer, Loader, Modal
│   └── moneylog/           # Core domain
│       ├── ActiveLog, Group, GroupArchive, LogsMenu
│       ├── LogPosts/       # Post list, editor, comments, digest
│       └── LogsSummary/    # Spending chart + insights, hot posts,
│                           #   achievements banner, group analytics hook
│
├── components/             # Shared, domain-agnostic UI
│                           #   Button, Modal, Tabs, Icon, CustomDropdown,
│                           #   ControlledInput, ErrorBoundary, ToastContainer,
│                           #   TutorialTooltip, UpdateBanner
│
├── contexts/               # CurrentUserContext, ToastContext, TutorialContext
│
├── hooks/                  # ~20 shared hooks
│                           #   Firestore queries: useGetGroup, useGetGroupUsers,
│                           #     useGetLogPosts, useGetLogPostComments, useGetUserInfo,
│                           #     useGetCurrentGroups, useLogGroupQuery, useLogPostQuery
│                           #   Behavior: useAchievements, useReadTracking, useImageUpload,
│                           #     useAppVersionRefresh, useDragReorderEnabled, useToast
│
├── config/                 # firebase-config.ts (app init, emulator wiring), links.ts
├── utils/                  # helpers, auth, groupBoundaries, memberOrder, unread,
│                           #   errorHandler (global singleton), configuredDayjs
├── types/                  # Shared TypeScript types (user, error)
└── test/setup.ts           # Vitest setup (jest-dom matchers)
```

### Routes

| Path                 | Component      | Auth required           |
| -------------------- | -------------- | ----------------------- |
| `/`                  | `Home`         | Yes                     |
| `/login`             | `Auth`         | No                      |
| `/about`             | `About`        | No                      |
| `/create`            | `CreateNewLog` | No                      |
| `/me`                | `UserSettings` | Yes                     |
| `/g/:groupId`        | `GroupPage`    | No (spectators allowed) |
| `/g/:groupId/invite` | `InvitePage`   | Yes                     |

Auth gating is handled by the `CheckAuth` wrapper in `App.tsx`, which redirects to `/login` and preserves
the intended destination in router state.

## `functions/` — Cloud Functions

A separate npm package with its own build and lint step, deployed via `firebase deploy`. Four functions:

| Function                | Trigger                                     | Purpose                                                                            |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `updatePostMetadata`    | `onDocumentCreated` on `log_posts/{postId}` | Stamps server timestamps, denormalizes author name/timezone, updates user tracking |
| `updateCommentMetadata` | `onDocumentCreated` on comments             | Same treatment for comments                                                        |
| `processUploadedImage`  | `onObjectFinalized` (Storage)               | Resizes and optimizes uploads with `sharp`                                         |
| `processGroupAnalytics` | `onCall` (callable)                         | Computes spending percentiles for a group                                          |

## Storage layout

Three prefixes, each with distinct rules (`storage.rules`):

- `inline/{groupId}/…` — images embedded directly in markdown. Public read, authed write, 10 MB image-only cap.
- `uploads/{groupId}/{postId}/…` — raw uploads awaiting Cloud Function processing. Authed read/write.
- `images/{groupId}/{postId}/…` — optimized output. Public read, backend-only write.

## Development

```bash
vp install
firebase emulators:start   # Auth :9099, Firestore :8888, Storage :9199, UI :1331
vp dev                # Vite dev server on :5173
npm run seed-emulator      # Populate emulator with dummy data (not necessary most of the time)
```

Emulator data is wiped each session. Local `.env` values are not committed.

| Script                  | Does                                         |
| ----------------------- | -------------------------------------------- |
| `vp dev`                | Dev server                                   |
| `vp build`              | Production build, then stamps `version.json` |
| `vp check`              | Oxlint + TypeScript + React rules            |
| `vp test`               | Vitest (run once)                            |
| `npm run seed-emulator` | Seed local Firestore                         |

Linting and formatting run automatically on staged files pre-commit.

## Design Guidelines

- Reuse existing styles as much as possible. If new designs are necessary, stick to the monochrome, retro Terminal-like aesthetic of the current app.
- Never introduce new colours.
- Never introduce rounded corners, drop shadows, or gradients.

## Coding and Agent Rules

- Run `vp check` against staged files only before a commit. (`staged: { "*": "vp check --fix" }`)
- Write accompanying unit tests to any new features that don't require extensive mocking.

## Testing

Vitest + Testing Library + jsdom. Roughly 25 test files in `__tests__/` directories co-located with the
code they cover — concentrated in hooks, auth error handling, spending analytics, and pure utils.

## Deployment

Two GitHub Actions workflows deploy to Firebase Hosting: one on merge to the default branch, one that
builds preview channels for pull requests. `index.html` and `version.json` are served `no-cache`; hashed
assets under `assets/` get a one-year immutable cache. The app polls `version.json` (`useAppVersionRefresh`)
and shows an `UpdateBanner` when a long-open tab is running a stale build.
