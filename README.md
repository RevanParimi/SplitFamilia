# SplitFamilia

A shared-expense ledger for families and friends: add the people in a group, log who paid for
what, and see who owes whom in the fewest payments. Any trip or occasion: a holiday, a wedding,
a festival, a weekend away.

- **Live app:** https://splitfamilia.up.railway.app
- **Coming next:** an Android app on Google Play (a Trusted Web Activity wrapping the live app).
- **Status and next steps:** [docs/planning/HANDOFF.md](docs/planning/HANDOFF.md).

It is a small progressive web app with no build step: plain HTML, CSS and JavaScript, with data
in Firebase Firestore. It works offline after the first visit and syncs live between phones.
There is no sign-in; a group's private invite link is its key.

The data is moving from Firebase to Railway (tasks T-08 and T-09). Railway now runs a small Node
server with a SQLite database and a ledger API; the page switches to it in T-09.

## Where things are

```
SplitFamilia/
│
│  The app: these files are the website, served as they are
├── index.html              the whole interface (HTML, CSS, start-up script and main module)
├── money.js                balance maths in whole paise
├── group-code.js           group codes and invite links
├── sync-status.js          the sync status and plain error messages
├── service-worker.js       offline start: caches the app and the Firebase SDK
├── manifest.json           the installable-app description (name, icons, colours)
├── icon-192.png, icon-512.png, apple-touch-icon.png
├── .well-known/
│   └── assetlinks.json     lets the Android app open the site without a browser bar
├── ledger-rules.js         what a group may hold (limits), shared by the server and, from T-09, the page
├── ledger-client.js        the page's live-update connection to the server (used by the page from T-09)
│
│  The server on Railway (Node, built-in modules only)
├── server/
│   ├── main.js             starts it: port, database file, shutdown
│   ├── server.js           routes a request to the files, /healthz or the API
│   ├── static.js           serves the app's files, and only those, with their headers
│   ├── db.js               the SQLite database: tables, migrations, queries (money in whole paise)
│   ├── api.js              the ledger API under /api/, with its checks and the guessing limit
│   └── live.js             live updates: one event stream per open page
├── data/                   the local database when you run the server here (git-ignored)
│
│  Hosting on Railway
├── Dockerfile              builds the server image with only the app's files and the server
├── .dockerignore           keeps everything else out of that image
├── railway.json            Railway's build, health check (/healthz) and redeploy rules
│
│  Database security
├── firestore.rules         who may read and write what in Firestore
├── firebase.json           tells the Firebase tools where the rules are
│
│  Development
├── package.json            test commands and the pinned test tools
├── package-lock.json       exact versions of those tools
├── tests/                  `npm test` (no network) and tests/rules/ (Firestore emulator)
│
│  Documentation
├── docs/
│   ├── google-play/        owner guides for the release: Play Console, Railway, Firestore rules, audit
│   ├── design/             the approved UI design (Claude Design): notes, prototype, mock-ups
│   └── planning/           the plan: state, handoff, stories, receipts, review checklist
├── CLAUDE.md               working rules for Claude Code sessions
└── README.md               this file
```

**Why the app's files sit at the top level:** there is no build step, so the repository's top
level *is* the website. The service worker only controls the folder it sits in, and
`.well-known/` must be at the site's root. Railway (`railway.json`), Firebase (`firebase.json`)
and npm (`package.json`) each look for their file at the top level too. Nothing under `docs/` or
`tests/` is shipped: the `Dockerfile` copies only the app's files and `server/`, and the server
serves only a fixed list of the app's files (never its own code or the database).

## Run it locally

```
npm start
```

Then open http://localhost:8080. This runs the same server as Railway: the page, `/healthz` and
the API, with the database in `data/`. Restart it after editing a page file. For page-only work,
`python -m http.server 8000` still works (no API). The service worker needs `http://localhost` or
HTTPS, not `file://`.

## Test it

| Command | What it runs | Needs |
|---|---|---|
| `npm test` | The balance maths, group codes, sync status, the real service worker against a fake network, the server (files, database, API, live updates) in-process on 127.0.0.1 with a temporary database, and checks that the page, worker, server, `Dockerfile` and rules agree | Node 24 (for `node:sqlite`); no install, no network |
| `npm run test:rules` | The Firestore rules on the local emulator (a `demo-` project, never real data) | `npm install` and Java 21 |

## Deploying

A push to `main` deploys: Railway rebuilds the live app, and the database on its volume is kept.
An older copy on GitHub Pages is also updated until every phone has moved to the Railway address. The Firestore rules are deployed
separately, by hand: see [docs/google-play/FIRESTORE_RULES.md](docs/google-play/FIRESTORE_RULES.md).
The Railway setup is in [docs/google-play/HOSTING_RAILWAY.md](docs/google-play/HOSTING_RAILWAY.md).
