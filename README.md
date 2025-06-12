# moneylogs

This is a personal finance microblogging app built in React with Vite. It is currently in closed beta at https://moneylogs-89ebf.web.app/

## Environment variables

Please message me for local `.env` variables.

## Installation

Installation requires [Node.js](https://nodejs.org/en/) v20+.

Make sure to run `npm install` first on initial install.

To run locally:

```bash
npm run
```

or

```bash
npx vite
```

The app will run locally on port 5173.

## Data

Data is handled by Firebase. Please contact me if you need any details on data collections and their schemas.

⚠️ **Warning:** All app data is currently shared with live, production data. Please be very careful in development, and create a dummy log group for testing.

## Deployment

Pushes and merges to `main` are automatically deployed via GitHub Actions. Please make all PRs merge to `develop`.
