# moneylogs

This is a personal finance microblogging app built in React with Vite. It is currently in closed beta at https://moneylogs-89ebf.web.app/

## Environment variables

Please message me for local `.env` variables.

## Installation

Installation requires [Node.js](https://nodejs.org/en/) v20+.

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
npm run
```

or

```bash
npx vite
```

The app will run locally on port **5173**.

### Troubleshooting

#### 'Port taken' errors

Our emulators are set up to listen on ports **9099**, **8888**, **5522**, and **1331**. Make sure these are available.

#### Java not found

Make sure you have Java and JDK 24+ installed.

#### Permission errors

Make sure Firebase CLI is installed globally. (Did you forget the `-g` flag in `npm install -g firebase-tools`?)

## Deployment

Pushes and merges to `main` are automatically deployed via GitHub Actions. Please make all PRs merge to `develop`.
