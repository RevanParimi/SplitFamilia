# SplitFamilia

A shared-expense ledger for families and friends: add the people in a group, log who paid for
what, and see who owes whom in the fewest payments. Any trip or occasion: a holiday, a wedding,
a festival, a weekend away.

- **Live app:** https://splitfamilia.up.railway.app
- **Coming next:** an Android app on Google Play (a Trusted Web Activity wrapping the live app).
- **Status and next steps:** [docs/planning/HANDOFF.md](docs/planning/HANDOFF.md).

It is a small progressive web app with no build step: plain HTML, CSS and JavaScript, served
with its own small Node server and SQLite database on Railway. It works offline after the first
visit: the phone keeps a copy of its group, and changes made offline wait on the phone until
they sync. Changes reach every open phone live. There is no sign-in; a group's private invite
link is its key.

Until T-09's switch-over the live app still uses Firebase Firestore; the move is in
[docs/google-play/MOVE_FROM_FIREBASE.md](docs/google-play/MOVE_FROM_FIREBASE.md).

## Where things are

```
SplitFamilia/
│
│  The app: these files are the website, served as they are
├── index.html              the whole interface (HTML, CSS, start-up script and main module)
├── money.js                balance maths in whole paise
├── group-code.js           group codes and invite links (and the "moved" notice for the old address)
├── sync-status.js          the sync status and plain error messages
├── ledger-rules.js         what a group may hold (limits), checked by the page and the server
├── ledger-client.js        the page's side of the server: read a group, send a change, live updates
├── outbox.js               the phone's copy of its group, and its changes waiting to sync
├── service-worker.js       offline start: caches the app (never the API)
├── manifest.json           the installable-app description (name, icons, colours)
├── icon-192.png, icon-512.png, apple-touch-icon.png
├── .well-known/
│   └── assetlinks.json     lets the Android app open the site without a browser bar
│
│  The server on Railway (Node, built-in modules only)
├── server/
│   ├── main.js             starts it: port, database file, shutdown
│   ├── server.js           routes a request to the files, /healthz or the API
│   ├── static.js           serves the app's files, and only those, with their headers
│   ├── db.js               the SQLite database: tables, migrations, queries (money in whole paise)
│   ├── api.js              the ledger API under /api/, with its checks and limits
│   └── live.js             live updates: one event stream per open page
├── data/                   the local database when you run the server here (git-ignored)
│
│  Hosting on Railway
├── Dockerfile              builds the server image with only the app's files and the server
├── .dockerignore           keeps everything else out of that image
├── railway.json            Railway's build, health check (/healthz) and redeploy rules
│
│  Development
├── package.json            `npm start` and `npm test` (no dependencies)
├── package-lock.json       says there are none
├── scripts/
│   └── move-from-firestore.mjs   the one-off copy of the old data (not shipped)
├── tests/                  `npm test` (no network, no install)
│
│  Documentation
├── docs/
│   ├── google-play/        owner guides for the release: Play Console, Railway, the move from Firebase, audit
│   ├── design/             the approved UI design (Claude Design): notes, prototype, mock-ups
│   └── planning/           the plan: state, handoff, stories, receipts, review checklist
├── CLAUDE.md               working rules for Claude Code sessions
└── README.md               this file
```

**Why the app's files sit at the top level:** there is no build step, so the repository's top
level *is* the website. The service worker only controls the folder it sits in, and
`.well-known/` must be at the site's root. Railway (`railway.json`) and npm (`package.json`)
look for their file at the top level too. Nothing under `docs/`, `scripts/` or `tests/` is
shipped: the `Dockerfile` copies only the app's files and `server/`, and the server serves only a
fixed list of the app's files (never its own code or the database).

## Run it locally

```
npm start
```

Then open http://localhost:8080. This runs the same server as Railway: the page, `/healthz` and
the API, with the database in `data/`. Restart it after editing a page file. The page needs its
server now (`python -m http.server` shows the page but can't open a group). The service worker
needs `http://localhost` or HTTPS, not `file://`.

## Test it

| Command | What it runs | Needs |
|---|---|---|
| `npm test` | The balance maths, group codes, sync status, the outbox, the real service worker against a fake network, the server (files, database, API, live updates) and the page's client in-process on 127.0.0.1 with a temporary database, the move script against fake Firestore answers, and checks that the page, worker, server and `Dockerfile` agree | Node 24 (for `node:sqlite`); no install, no network |

## Deploying

A push to `main` deploys: Railway rebuilds the live app, and the database on its volume is kept.
An older copy on GitHub Pages is also updated until it is turned off (the switch-over's last
step); after T-09 it only shows "SplitFamilia has moved". The Railway setup is in
[docs/google-play/HOSTING_RAILWAY.md](docs/google-play/HOSTING_RAILWAY.md), and the switch-over
from Firebase in [docs/google-play/MOVE_FROM_FIREBASE.md](docs/google-play/MOVE_FROM_FIREBASE.md).
