# moneylogs

This is a personal finance microblogging app built in React with [Vite+](https://voidzero.dev/posts/announcing-voidzero-inc). It is currently in closed beta at https://moneylogs-89ebf.web.app/

## Environment variables

Please message me for local `.env` variables.

## Installation

Installation requires [Node.js](https://nodejs.org/en/) v24+.

Make sure to run `npm install` first on initial install.

## Data

Data is handled by Firebase. Please contact me if you need any details on data collections and their schemas.

We use Firestore Emulators for local testing and development. Firestore Emulators are locally-run versions of the database to keep production data safe and separate.

### Using Emulators

Required installs:

- Firebase CLI (`npm install -g firebase-tools`)
- Java Runtime Environment (JRE 11 or higher)
- [JDK 24+](https://www.oracle.com/java/technologies/downloads/#jdk24-mac)

Run emulators:

```bash
firebase emulators:start
```

## Run local dev server

```bash
npm run dev
```

The app will run locally on port **5173**.

## Linting

Linting is handled by Vite+ (oxc + TypeScript + React rules) and runs automatically on staged files before each commit.

To lint manually:

```bash
npm run lint
```

## Dummy data

Because they are locally run, development data is completely tied to your current development session and wiped each time.

To have some dummy data to work with, execute the seed script:

```bash
npm run seed-emulator
```

Create a temporary account for testing at [http://localhost:5173/login](http://localhost:5173/login), then visit any group at its shareable URL to join it as a member.

An example of a shareable URL is `http://localhost:5173/g/LOG_GROUP_DOC_REF_ID` where `LOG_GROUP_DOC_REF_ID` is the ID of any item in the `log_groups` collection, which can be viewed [here](http://localhost:1331/firestore/default/data/log_groups/) after the seed script has been run and the emulators are running.

### Troubleshooting

#### 'Port taken' errors

Our emulators are set up to listen on ports **9099**, **8888**, **5522**, and **1331**. Make sure these are available.

#### Java not found

Make sure you have Java and JDK 24+ installed.

#### Permission errors

Make sure Firebase CLI is installed globally. (Did you forget the `-g` flag in `npm install -g firebase-tools`?)

## Deployment

Pushes and merges to `main` are automatically deployed via GitHub Actions. Please make all PRs merge to `develop`.
