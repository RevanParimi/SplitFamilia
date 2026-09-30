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
│
│  Hosting on Railway
├── Dockerfile              builds the web server image with only the app's files
├── .dockerignore           keeps everything else out of that image
├── Caddyfile               the web server's settings (port, headers)
├── railway.json            Railway's build, health check and redeploy rules
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
`tests/` is shipped: the `Dockerfile` copies only the app's files.

## Run it locally

```
python -m http.server 8000
```

Then open http://localhost:8000. The service worker needs `http://localhost` or HTTPS, not
`file://`.

## Test it

| Command | What it runs | Needs |
|---|---|---|
| `npm test` | The balance maths, group codes, sync status, the real service worker against a fake network, and checks that the page, worker, `Dockerfile` and rules agree | Node 22 or later; no install, no network |
| `npm run test:rules` | The Firestore rules on the local emulator (a `demo-` project, never real data) | `npm install` and Java 21 |

## Deploying

A push to `main` deploys: Railway rebuilds the live app. An older copy on GitHub Pages is also
updated until every phone has moved to the Railway address. The Firestore rules are deployed
separately, by hand: see [docs/google-play/FIRESTORE_RULES.md](docs/google-play/FIRESTORE_RULES.md).
The Railway setup is in [docs/google-play/HOSTING_RAILWAY.md](docs/google-play/HOSTING_RAILWAY.md).
