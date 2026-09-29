# T-03 implementation receipt — Database rules, offline start, honest sync status, the SplitFamilia name and Railway hosting

- **Task:** T-03. Stories, in order: [SF-007](../stories/SF-007.md), [SF-008](../stories/SF-008.md),
  [SF-009](../stories/SF-009.md), [SF-010](../stories/SF-010.md), [SF-011](../stories/SF-011.md).
- **Phase:** implementation, in two sessions on 2026-09-29: about 12:21–13:00 IST (everything
  except SF-007's emulator run), then about 14:43–15:20 IST (the emulator run). The self-checks
  here are **not** the fresh-session review.
- **Outcome: implemented, ready for review.** SF-008 to SF-011 were done and self-checked in the
  first session. SF-007's emulator run was blocked there: the JDK download (approved as D-8) was
  refused by that session's permission check, and D-11 asked the owner. The owner installed
  Eclipse Temurin 21 at 14:41 IST (D-11 option a). In the second session `npm install` created
  `package-lock.json`, **`npm run test:rules` passed 15 of 15** (twice), and 4 emulator break
  checks were each caught. No rule or test needed changing. See "Second session" under Tests.
- **Baseline:** commit `8898b50` on `main`, up to date with `origin/main`. The working tree held
  T-01's and T-02's uncommitted, reviewed work; at the start its files matched the T-02 receipt's
  hashes exactly (`index.html` `beebb932…`, `service-worker.js` `445f0cf5…`, `money.js`
  `cd8a67e4…`, `group-code.js` `d8f418fb…`), and `npm test` passed 41/41. Nothing was committed,
  pushed or deployed in this phase.
- **Review input:** the SHA-256 of each file's working-tree bytes (`sha256sum <file>`). All the
  files below now have LF endings on disk (the editing tools wrote LF; `index.html` was CRLF
  before). `core.autocrlf=true` normalises endings on commit, so the committed content is
  unaffected.

  | File | SHA-256 |
  |---|---|
  | `index.html` | `f3d5afce471499215700a4c7250585a6658c33b4b32b84c3c17f348a31148ba0` |
  | `service-worker.js` | `2754ef7faa1b6cf98e0715bc854dbd12d0ba28896ae2144cd9a9678ca0f665df` |
  | `manifest.json` | `418f91eb81e974eac32d385d4e445148a78972eb9a99a93edff50d0a0c7e15fa` |
  | `sync-status.js` (new) | `6394cd4806b226e27b4337d6163f01c11ab1ccdfed6158808e628b4910691697` |
  | `package.json` | `fb2c073a090e219ff804d7e9765947cacb0f93f1ce01e6f24cd993221f53de40` |
  | `firestore.rules` (new) | `8ba1333edc813e08f59c23ebc622b39954bfa1021134341c2fcbb6db2a5bc1df` |
  | `firebase.json` (new) | `e87125f3ec6439a59ba44d80a6dcc46378a27a0644b0cda30abeafd2efb67e20` |
  | `Dockerfile` (new) | `4aa6f725a6064c500c92ca7e597ce3867ef928d774de30c4dede0ec2527bede6` |
  | `.dockerignore` (new) | `048d3499b9e40e9a898abc8f35c427daa4fbd1c3f0fe2088086f88ea1e14c66d` |
  | `Caddyfile` (new) | `bea84b58b2f2aad8d6484d1a2da967c9343709399742a4465fa5664c3f3944aa` |
  | `railway.json` (new) | `a28c2d1f4d0ebe6dcc5cac1f1af787ac1e9d76165001c72bf53b60de79144d0d` |
  | `.well-known/assetlinks.json` (new) | `8602dffb81e490d7c4a43ee97e6c29e448952ed6f57bd883b4adfd1a91d9b8cb` |
  | `tests/sync-status.test.js` (new) | `e4d149424360cd8b98c04550da8350adf311e80308551e8a33f3548d38f024ce` |
  | `tests/service-worker.test.js` (new) | `2493a1f5dc8f21d46f424e5054675b21efb3ed43a0e2e0cfa5efc193039e0387` |
  | `tests/wiring.test.js` | `9d804027de43905ecef8467e82f448fbd7ffcc529504a2269e4516fa2f999b5e` |
  | `tests/rules/firestore-rules.test.js` (new) | `20bceeb6f8b7407db3a9d2fe18a071c42796b27150dbcaa50b82a4b187fd1e28` |
  | `docs/google-play/HOSTING_RAILWAY.md` (new) | `40e8dfc30a0ccb63f577ebd5a11234039f8974242b75336af2e96d1145cf5941` |
  | `docs/google-play/FIRESTORE_RULES.md` (new; section 2 updated in the second session) | `690f0b1c15f68cf2daae77def36d9c797f7802e6a757404f60665a60716d7c46` (first session: `858db4bb…`) |
  | `docs/planning/evidence/T-03-browser-check.mjs` (new, evidence only) | `4a1fcf18a9847d043cc7fe6adfff1e5fe4489b617c8bb3ff00ead33152425388` |
  | `docs/planning/evidence/T-03-browser-check-output.json` (new, evidence only) | `1036bb413848ba8c62196f842ca36040d2e8e46ce5f95420029d5a82c343f9af` |
  | `docs/planning/evidence/T-03-caddy-headers.txt` (new, evidence only) | `3b70ed162625d37647d32063f0f7b66acef3e52207804dfad99335ec71757723` |
  | `package-lock.json` (new, second session) | `c328333b67ebc7f4e6da0ff9d0e1f50ce4be7614aa135cf3acf31a0ea6ba28c8` |
  | `docs/planning/evidence/T-03-rules-emulator.txt` (new, second session, evidence only) | `102c244f9fa1f7cb89d99a329c07ae1be924ef58602adb2cb394a8e31f41a794` |
  | `money.js`, `group-code.js`, `tests/money.test.js`, `tests/group-code.test.js` | unchanged from T-02 (`cd8a67e4…`, `d8f418fb…`, `308bd7a9…`, `10ee363d…`) |

  The second session changed no app, rules, test or hosting file. `firestore.rules`,
  `firebase.json`, `package.json` and `tests/rules/firestore-rules.test.js` matched this table
  before and after the emulator runs. It added `package-lock.json` and the emulator transcript,
  and changed only documentation: `FIRESTORE_RULES.md` (new hash above), and, not hashed here,
  `PRODUCTION_AUDIT.md`, the SF-021, SF-022 and SF-023 cards, this receipt, STATE.json and
  HANDOFF.md.

  Diff of the tracked app files against the baseline commit:
  `git diff 8898b50 -- index.html service-worker.js manifest.json | sha256sum` →
  `6756e51705ed4b7e055aa44437f980de3150732f15ca0e3be77e5247945ebf62` (3 files, 522 insertions,
  126 deletions; this includes T-01's and T-02's parts).

## What it does, in one example per story

- **SF-007:** a script that asks the database for "all groups" is refused, and so is an expense
  with `amount: "lots"`; the family's group still opens by its code, and adding and deleting
  people and expenses still work. On the emulator: 15 of 15 tests pass, and allowing `list` on
  `groups` makes "denied: listing every group" fail.
- **SF-008:** open the family group once, then open the app with no network at all: the ledger
  appears from the phone's copy. In the browser check, a group with 2 people and a ₹90 expense
  reopened offline showing "Chai … waiting to sync ₹90.00" and "Ben owes Asha ₹45.00". If the
  Firebase files can't be fetched, the page says "Can't reach SplitFamilia. Check your
  connection." with Retry, instead of a join form that does nothing.
- **SF-009:** the bar said "· live" even offline. Now, offline with that unsaved expense, it says
  "· offline: 3 changes waiting to sync", and a group the rules refuse says "This group can't be
  opened. Check the invite link." instead of "Missing or insufficient permissions."
- **SF-010:** the app is called SplitFamilia everywhere (title, headings, home-screen name).
  Opened by the Android app, the "Install app" button and the iPhone tip are gone; in a normal
  browser tab they still show.
- **SF-011:** `Dockerfile`, `Caddyfile`, `.dockerignore`, `railway.json` and
  `.well-known/assetlinks.json` are ready. The real Caddy server, serving exactly the files the
  image would hold, sent `Cache-Control: no-cache`, `nosniff` and the referrer policy on every
  file, and 404 for `docs/`, `tests/` and `package.json`. The owner's steps are in
  `docs/google-play/HOSTING_RAILWAY.md`.

## Per-story status

| Story | Done? | Acceptance criteria met | Notes |
|---|---|---|---|
| SF-007 | Yes | All. Rules and `firebase.json` (firestore only); default deny; every allow and deny on the card, with codes checked against the SF-005 pattern; `maxlength` on name and description; emulator tests for every case under a `demo-` project, `npm run test:rules` **15/15 on the emulator** (second session); emulator break checks BR1–BR4 caught; `npm test` network-free; deploy command and PC-002; PC-001 recorded below. | First session blocked on Java (D-11); finished in the second session. BR3 ran in a scratch copy (L13). |
| SF-008 | Yes | All. SDK cached by the worker (D6); boot-failure panel with Retry; no native form submit; offline reopen shows the ledger from Firestore's cache; cache bumped. F-4 tests added. | The "clear site data, go Offline" case: see L3. |
| SF-009 | Yes | All. Metadata-driven status plus online/offline events; "waiting to sync" rows; pure error mapping with tests; `console.error` with codes only; global handlers; cache bumped. F-3 fixed and P3 re-run (F1, F2). | |
| SF-010 | Yes | All. In-app hides the install button and iPhone tip; a normal tab shows both; the name is SplitFamilia in the manifest, title, headings and Apple title; `splitsheet-` cache prefix and `splitsheet-group` kept (D17). | Real installed PWA and TWA not tried (L4). |
| SF-011 | Yes | All, with the Docker gap recorded: files copied explicitly and backed by `.dockerignore`; `$PORT`; dotfiles served; the four headers; `railway.json`; `assetlinks.json` with marked placeholders; manifest `id`, `start_url`, `scope` unchanged; the `http://` and `localhost` grep; `curl -I` on each file from the real server binary; the owner's guide; PC-003. | Docker isn't installed, so the image wasn't built (L2). |

## Changes

| File | Story | What changed |
|---|---|---|
| `firestore.rules` (new) | SF-007 | Default deny. `get` a group by a valid code; create or update it as `{currency}` (1–3); `get`/`list` people and expenses; create a person `{name}` (1–60); create an expense with exactly `date`, `desc` (1–200), `amount` (number, 0 < a ≤ 10,000,000), `paidBy`, `split` (list of 1–50); delete people and expenses. Codes must match `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 80 characters. |
| `firebase.json` (new) | SF-007 | `{"firestore": {"rules": "firestore.rules"}}` only. |
| `tests/rules/firestore-rules.test.js` (new) | SF-007 | 15 emulator tests (6 allowed, 9 denied groups of cases; listed below). Not in `npm test`'s glob. |
| `package.json` | SF-007 | `test:rules` script; devDependencies pinned: `firebase-tools` 15.32.0, `@firebase/rules-unit-testing` 5.0.2, `firebase` 12.17.1. |
| `package-lock.json` (new, second session) | SF-007 | Created by `npm install` (npm 11.19.0, lockfile v3): 730 packages, every one `resolved` from `https://registry.npmjs.org` with an `integrity` hash; no private registry, name or email in it. Not shipped (the `.dockerignore` allowlist). Commit it (D5). |
| `service-worker.js` | SF-008 | Cache `splitsheet-v5`; `SHELL` adds `./sync-status.js?v=5`; new `SDK` list (the two gstatic 12.17.1 files) installed with the shell and served cache-first; the page cached once under `./index.html` whatever its `?g=`; redirected responses never kept; the `?v=` and `cache: "reload"` rules kept. |
| `index.html` | SF-008 | A classic start-up script (in-app flag, boot watchdog, capture-phase submit guard); a `#boot` panel shown until the module starts; the join screen hidden until the module shows it; Firebase start-up in `try`/`catch`; `splitBoot.ready()`. |
| `sync-status.js` (new) | SF-009 | `friendlyError`, `countPending`, `syncStatusText`. |
| `index.html` | SF-009 | `#notice` message bar; `reportError` and a global `error`/`unhandledrejection` handler (codes only in the console); listeners with `includeMetadataChanges`; status from snapshot metadata and online/offline events; "waiting to sync" on unsaved ledger rows; no `alert()` of Firestore text; F-3 guard (`appStarted`) and "Start group" disabled during a "Join" check; unused `updateDoc` import removed. |
| `index.html`, `manifest.json` | SF-010 | SplitFamilia in `<title>`, both headings, `apple-mobile-web-app-title`, manifest `name` and `short_name`; `.web-only` on the install button, the iPhone tip and part of the join note, hidden under `html.in-app`. |
| `index.html` | SF-007 | `maxlength="60"` on the person name, `maxlength="200"` on the description. |
| `Dockerfile`, `.dockerignore`, `Caddyfile`, `railway.json`, `.well-known/assetlinks.json` (new) | SF-011 | The Railway hosting files. |
| `tests/sync-status.test.js` (new) | SF-009 | 11 tests. |
| `tests/service-worker.test.js` (new) | SF-008 (F-4) | 13 tests: the real worker in `node:vm` with a fake cache and network. |
| `tests/wiring.test.js` | all | 10 tests (was 3): the three modules and their `?v=`; the SDK list against the page's imports; the Dockerfile and `.dockerignore` against `SHELL`; no `http://` or `localhost` in shipped files; rules limits against `money.js`, `group-code.js` and the page's `maxlength`s; the name and the kept identifiers; `assetlinks.json`. |
| `docs/google-play/HOSTING_RAILWAY.md`, `FIRESTORE_RULES.md` (new) | SF-011, SF-007 | Owner guides. |
| `docs/planning/evidence/T-03-*` (new) | all | Browser check, its output, the Caddy transcript. |
| `CLAUDE.md`, `docs/planning/REVIEW.md`, `docs/google-play/PRODUCTION_AUDIT.md`, story cards SF-012, 013, 017, 021, 022, 023, 028, 029 | task | See Documentation. |

## Decisions for the reviewer

SF-007 (rules):

- **D1: a few bounds beyond the card's list:** `date` 1–40 characters and `paidBy` 1–100 (the
  card says only "string"). The app writes a 24-character ISO date and a 20-character Firestore
  ID, so nothing it does is refused; a multi-kilobyte junk string is.
- **D2: string lengths are Firestore's `size()`, while the page's `maxlength` counts UTF-16
  units.** The emulator tests include a 60-letter Devanagari name, a 30-emoji name (60 UTF-16
  units) and a 200-letter Devanagari description, all expected to pass. If `size()` counts bytes,
  those tests fail and the limits need widening. **Settled on the emulator (second session): all
  three pass**, so `size()` doesn't count UTF-8 bytes (60 × `अ` is 180 bytes, 200 × `च` is 600).
  The runs don't show whether it counts code points or UTF-16 units, and they don't need to:
  either count is at most the UTF-16 length that `maxlength` caps, so everything the page lets
  through is accepted. BR3 (limit 59) shows the 60 edge is live.
- **D3: `get` of a group with no document is allowed** (groups made before T-02 have none), and
  `list` on `groups` is not, so nobody can enumerate groups.
- **D4: one source for each limit.** `npm test` reads `MAX_AMOUNT_PAISE`, `MAX_GROUP_ID_LENGTH`,
  the group-code pattern and the page's `maxlength`s and compares them with `firestore.rules`.
  Example: raising the description's `maxlength` to 500 fails the suite (B11).
- **D5: exact dev dependencies.** `firebase` is pinned to 12.17.1, the page's SDK version.
  `npm install` in the second session created `package-lock.json`, which should be committed.
  npm 11 skipped four install scripts it hasn't been told to allow (`@firebase/util`,
  `protobufjs`, `google-logging-utils`, `re2`); none matters here. `@firebase/util`'s only
  fills in a web config from `FIREBASE_WEBAPP_CONFIG`, and its stub files ship with the package.
  `re2` is optional for `firebase-tools`. The runs pass without them.

SF-008 (offline start):

- **D6: the SDK is cached by the service worker, not vendored.** `firebase-firestore.js` imports
  `firebase-app.js` by its absolute gstatic URL (checked: that is its only import, and
  `firebase-app.js` imports nothing), so vendoring would mean editing Google's file. The worker
  installs both URLs with the shell (from the HTTP cache if there: gstatic sends
  `max-age=31536000`, and the URL names the version) and serves them cache-first. Cost: an
  install with gstatic unreachable fails, and the old worker stays until a later visit (L6).
- **D7: the page is cached once, as `./index.html`, whatever its `?g=`** (T-02's L5). Example: after
  two invite links and an offline open of a third, the cache held one `/index.html` and no
  `?g=` key (R2c; T-02 saw 9 copies). Only `/` and `/index.html` in the worker's scope map to it,
  so a later `privacy.html` is cached as itself. A redirected response is never stored as the
  page, because a browser refuses one for a navigation.
- **D8: the start-up panel is driven by a classic script**, because a module whose import fails
  never runs. A capture-phase `error` listener on `window` sees a failed `<script>` at once
  (gstatic blocked: the panel appeared within 2.6 s, R4), and a 10-second watchdog covers a hang.
  The module calls `splitBoot.ready()`, which also removes a panel that appeared only because the
  start was slow (F9: the SDK was held 11.5 s; the panel appeared, then the join screen replaced
  it). Retry reloads the page.
- **D9: one capture-phase `submit` listener prevents every native form submit**, even when the
  module never ran (R4's probe: `defaultPrevented` true). The module's own handlers still run.
- **D10 (F-4): the worker's protections are tested by running `service-worker.js` itself** in
  `node:vm` with a fake cache and network, in a new `tests/service-worker.test.js`, not by text
  assertions in `wiring.test.js` as the card suggested. Removing "a cached `?v=` URL is final"
  (B1) or `cache: "reload"` (B2) each fails a test.

SF-009 (status and errors):

- **D11: status order:** stopped listener → "not syncing"; offline → "offline: …"; unsaved
  changes → "N changes waiting to sync"; no first snapshot yet, or any snapshot from the cache →
  "connecting…"; otherwise "live". Example (R1): online, Firestore unreachable → "· connecting…",
  then "· 3 changes waiting to sync" after adding two people and an expense.
- **D12: the pending count is "at least".** Each unsaved document counts once; a pending delete
  leaves no document, so a waiting snapshot with none counts as 1.
- **D13: errors go to one message bar (`#notice`, `role="alert"`), not `alert()`.** Write errors
  say what failed, then the plain message: "Couldn't add that person. This group can't be opened.
  Check the invite link." (F4). A stopped listener shows only the plain message (F3). The form's
  own checks ("Add a description.") still use `alert()`: they were never raw (→ SF-028).
- **D14: the console gets a fixed text plus the error code** ("SplitFamilia: sync stopped
  permission-denied"), or the error's name for unexpected errors ("unexpected error Error"). In
  F3–F5 the console never held the group code, "Secret Name" or the thrown error's text.
- **D15 (F-3): at most one group per page load.** `openGroup()` and `startApp()` return when a
  group is open, and "Start group" is disabled while a "Join" check runs. F1 (the T-02 P3
  sequence): the Start click did nothing, the join opened `rv-odd`, and both writes went to
  `rv-odd`. F2 (the form forced with `requestSubmit`): the new group opened, the late check was
  ignored, and the write went to the new group; only one group's listeners ever started.

SF-010 (name and Android text):

- **D16: "in the app" means standalone display mode, iOS's `navigator.standalone`, or an
  `android-app://` referrer, remembered for the tab in `sessionStorage`
  (`splitfamilia-in-app`).** "Switch group" loads a new document whose referrer is the site
  itself; without the flag, the Android app would show the install button again (F8 shows it
  stays hidden).
- **D17: identifiers kept:** the cache prefix `splitsheet-`, the `localStorage` key
  `splitsheet-group` and the manifest `id` `/splitsheet/`. Renaming the key would log every phone
  out of its group; changing the `id` would make installed copies a different app. `npm test`
  pins all three. Manifest `name` and `short_name` are both "SplitFamilia" (was "Splitsheet —
  shared expense ledger" and "Splitsheet").
- **D18: the join note now reads "Your group's data is stored in the cloud, not on this device"**,
  with ", so installing the app won't lose it" only in a browser tab.

SF-011 (hosting):

- **D19: Caddy, not nginx.** Caddy reads `{$PORT:8080}` itself, so no template step, and the same
  binary runs on Windows, which let this session test the real server with the real config
  while Docker is missing. The image is `caddy:2.11.4-alpine` (checked on Docker Hub,
  2026-09-29).
- **D20: `Cache-Control: no-cache` on every file**, not only the three the card names. Revalidation
  is cheap (a 304 with the ETag), and it covers T-02's L6 for all files; the worker does the
  offline caching.
- **D21: `railway.json` redeploys only on app or hosting files** (`/index.html`, `/manifest.json`,
  `/*.js`, `/*.png`, `/.well-known/**`, `/Dockerfile`, `/.dockerignore`, `/Caddyfile`,
  `/railway.json`; Railway's gitignore-style watch paths, checked 2026-09-29), with a health
  check on `/`. The guide asks the owner to set `PORT=8080` so the domain's port is certain.
- **D22: the `Dockerfile` names each file, and `.dockerignore` is an allowlist.** A wiring test
  fails if a file the worker caches is missing from either (B12). `privacy.html` is not listed:
  it doesn't exist yet, and copying a missing file fails the build (note added to SF-017).
- **D23: `assetlinks.json` holds `<UPLOAD_KEY_SHA256>` and `<PLAY_APP_SIGNING_SHA256>`.** The
  wiring test accepts either a placeholder or a real `AB:CD:…` fingerprint, so SF-013 can fill
  them in; SF-021 fails the release on a placeholder.

The task as a whole:

- **D24: one cache bump for the task: `splitsheet-v4` → `splitsheet-v5`**, with `?v=5`.
- **D25: the browser check's real-SDK run can't touch the family's data.** Its server rewrote
  the page's project to `demo-t03-probe`, and every Firestore host was blocked on the page and
  the worker, with a second rule failing any request that got past. 50 Firestore requests were
  attempted and blocked; 0 received a response.

**PC-001, for the rollback target (SF-007):** on 2026-09-28 the owner reported that the Rules tab
had no `timestamp.date` line, so no test-mode expiry. The full text of the live rules was not
recorded. `FIRESTORE_RULES.md` step 3.1 asks the owner to save it before deploying, and the
console's rules editor keeps earlier versions.

## Tests

| Check | Command | Result |
|---|---|---|
| Unit, worker and wiring tests | `npm test` | **72 passed, 0 failed** (money 27, group codes 11, sync status 11, service worker 13, wiring 10), Node 24.21.0, no install, no network. Re-run in the second session, after `npm install`: **72 passed, 0 failed**. |
| Rules on the emulator | `npm run test:rules` (second session; Temurin 21.0.12.1's `bin` prepended to `PATH`) | **15 passed, 0 failed**, exit 0, twice: at 14:50 IST, and at the end on the restored rules file. 6 allowed and 9 denied test groups; 66 refused requests per run. Clean shutdown, no emulator left running. Transcript: `T-03-rules-emulator.txt`. |
| Rules control run | The unmodified rules, in a scratch copy whose `firebase.json` has no `rules` entry | **15 passed.** The emulator started "allowing all reads and writes", so the 9 denied tests pass only because the test file uploads `firestore.rules` itself. |
| Rules break checks on the emulator | Change `firestore.rules`, run the suite, restore, compare SHA-256 | **4 of 4 caught, each by exactly one test; the file restored byte-identical each time.** BR1 allow `list` on `groups` → "denied: listing every group" failed; BR2 amount limit 10,000,001 → "denied: an expense that isn't ledger-shaped"; BR3 name limit 59 → "allowed: add a person with a name of 1 to 60 characters, in any script"; BR4 `update` allowed on expenses → "denied: editing a person or an expense". BR1, BR2 and BR4 ran in the repo; BR3 in the scratch copy (L13). |
| Break checks B1–B15 | A scratch script applies each change, runs `npm test`, restores the file and compares its SHA-256 | **15 of 15 caught; every file restored byte-identical.** B1 `?v=` not final → 1 failed; B2 no `cache: "reload"` → 1; B3 each invite link cached separately → 3; B4 SDK not installed → 3; B5 SDK left to the network → 3; B6 redirected page kept → 1; B7 "live" from cache → 1; B8 raw error text → 1; B9 rules amount 10× → 1; B10 rules pattern allows `--` → 1; B11 description `maxlength` 500 → 1; B12 Dockerfile without `sync-status.js` → 1; B13 an `http://` URL in `index.html` → 1; B14 old title → 1; B15 worker SDK version out of step → 14. |
| Browser check | `node docs/planning/evidence/T-03-browser-check.mjs <repo> <scratch dir>` (headless Edge; page and worker both attached over CDP) | **Every check as expected; output in `T-03-browser-check-output.json`.** Summary below. Run 5 times while the harness was fixed; the final run is recorded. |
| Real server headers | Caddy 2.11.4 with the repo's `Caddyfile` on the files the `Dockerfile` copies; `curl -I` on each | Every file: `Cache-Control: no-cache`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`; `assetlinks.json` `application/json`; `docs/`, `tests/`, `package.json`, `firestore.rules`, `Caddyfile` → 404; gzip on; 304 on revalidation; no redirect of `/index.html`; `$PORT` unset → `:8080`. Transcript: `T-03-caddy-headers.txt`. |
| No `http://` or `localhost` in shipped files | `grep -nE "http://|localhost|127\.0\.0\.1"` on the 7 text files the image ships | No matches (also a wiring test). |
| No personal data in new files | `grep -rniE` for the owner's name, `gmail` and the owner's account-name fragments (the pattern isn't written here, since it would publish them) on every new file | Only the existing GitHub Pages address in `HOSTING_RAILWAY.md`. |

Emulator cases in `tests/rules/firestore-rules.test.js` (all pass on the emulator; second session):

- **Allowed:** open a group with and without a group document, and an 80-character code; list
  people and expenses, with and without `limit(1)`, and get one of each; start a group with
  `{currency: "₹"}` merged, change it (`$`, `Rs.`, `€`, by merge and by update); add people named
  `Chitra`, `C`, 60 × `x`, 60 × `अ`, 30 × `😀`; add expenses as the app writes them, with
  amounts 300, 99.5, 0.01 and 10,000,000, a 200-character description (Latin and Devanagari),
  splits of 1 and 50, and in a new-style group; delete a person and an expense.
- **Denied:** list `groups` (with and without a limit); collection-group queries on `people` and
  `expenses`; for 8 bad codes (`Goa-Trip`, `goa--trip`, `-goa`, `goa-`, `goa_trip`, `goa trip`,
  `goa.trip`, 81 characters) every read and write; group documents with an extra field, empty,
  `currency` of `""`, 4 characters or a number, and a merge that adds a field; deleting a group;
  people with an extra field, empty, `""`, 61 characters or a number; 23 bad expenses (amount
  `"lots"`, `"300"`, 0, −5, 10,000,000.01, NaN, Infinity or missing; description empty, 201
  characters, a number or missing; split `[]`, 51 items, a string or missing; payer empty, a
  number or missing; date a number, empty or missing; an extra field); editing a person or an
  expense by update and by set; other paths (`other/x`, a root `expenses`, `settlements` under a
  group, a sub-collection under a person).

Browser check highlights (run F uses fake Firebase modules; run R the real SDK against a demo
project with Firestore blocked):

- **F1, F2 (F-3):** see D15. `midway`: "Checking…", Join disabled, Start disabled.
- **F3:** `?g=rv-denied` (the fake refuses the listener with "Missing or insufficient
  permissions. groups/rv-denied") → message "This group can't be opened. Check the invite link.",
  bar "· not syncing", the raw text nowhere on the page, console `SplitFamilia: sync stopped
  permission-denied`.
- **F4:** a refused write → "Couldn't add that person. This group can't be opened. Check the
  invite link."; no dialog; the typed name not in the console.
- **F5:** a thrown error and a rejected promise → one message, "Something went wrong. If the page
  looks wrong, reload the app."; the console has "unexpected error Error" twice and never the
  error text.
- **F6:** a normal tab: the install button (after a simulated `beforeinstallprompt`) and the
  iPhone tip both show.
- **F7:** standalone → both hidden, on the ledger and the join screen, where the note loses its
  install clause. This Edge ignores CDP's `display-mode` emulation (`matches` stayed false), so
  `matchMedia` was answered by an injected script.
- **F8:** first document with an `android-app://com.splitfamilia.app/` referrer (injected; CDP
  drops that scheme) → hidden; after "Switch group" (real referrer `http://127.0.0.1…`) and joining
  again → still hidden.
- **F9:** the SDK held 11.5 s on a first visit → the panel "Can't reach SplitFamilia. Check your
  connection. Retry" at 10 s; released → the join screen, panel gone.
- **R1:** first open online (Firestore unreachable) → "· connecting…"; after adding Asha, Ben and
  "Chai" ₹90 → "· 3 changes waiting to sync", the row "waiting to sync", "Ben owes Asha ₹45.00".
  Cache `splitsheet-v5`: the 7 shell URLs and both gstatic SDK files.
- **R2:** page and worker offline and the site's server stopped → reopen: controlled,
  `navigator.onLine` false, the same people, row and balance, bar "· offline: 3 changes waiting to
  sync". **R2b:** an invite link never opened before → opens offline from the one cached page,
  "· offline: changes will sync when you're back online". **R2c:** still one `/index.html`, no
  `?g=` key.
- **R3:** back online (Firestore still blocked) → "· 3 changes waiting to sync" (not "live").
- **R4:** gstatic blocked, nothing cached → the panel within 2.6 s, no join screen, native submit
  prevented; unblocked → Retry → the join screen.
- Page errors: only the two errors F5 threw on purpose; in run R, `ERR_INTERNET_DISCONNECTED`
  resource logs while offline (fonts, the worker's background refresh).

Second session (the emulator run, 2026-09-29, about 14:43–15:20 IST):

- **Start:** `java` wasn't on this session's `PATH` (VS Code started before the install), but the
  owner's Temurin 21.0.12.1 was in `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`,
  with its `bin` on the machine `PATH` and `JAVA_HOME` set. Each run prepended that `bin` folder.
- **Install:** `npm install` added 729 packages in about 3 minutes and created
  `package-lock.json`; `npm ls` shows the three pinned versions. The first `test:rules` run
  downloaded `cloud-firestore-emulator-v1.22.0.jar` (130.4 MB) to
  `%USERPROFILE%\.cache\firebase\emulators`.
- **Result:** 15/15 with no change to the rules or the tests. One denial reads "evaluation error
  … for 'create'" beside "false for 'update'": it's the merge that adds `owner` to an existing
  group, which is an update, and the update rule refused it as intended.
- **Cleanup:** the `firestore-debug.log` the emulator writes in the repo (git-ignored) was
  deleted; three leftover emulator processes from aborted break runs were stopped, each matched by
  the emulator jar in its command line; the scratch copy's `node_modules` junction was removed as a
  link only. Nothing was committed, pushed or deployed.

Not exercised:

- building the Docker image and Railway itself (no Docker; the owner creates the service);
- the real Firestore, by design; an installed PWA, the Android app, a real phone, iOS Safari and
  Chrome (only headless Edge ran);
- a first launch with no connection and nothing cached, where the page itself can't load (L3).

## Documentation

- New: `docs/google-play/HOSTING_RAILWAY.md` (SF-011's owner guide, with every manual step
  labelled) and `docs/google-play/FIRESTORE_RULES.md` (what the rules allow, the emulator run,
  deploy and rollback).
- `CLAUDE.md`: Stack (three modules, the start-up script, the SDK in the worker), hosting files,
  rules, tests (the two new test files and `npm run test:rules`), the SDK-version rule in §5.
- `docs/planning/REVIEW.md`: the Offline invariant expanded; new invariants for honest status
  and plain errors, one group per page, and "only the app is shipped".
- `docs/google-play/PRODUCTION_AUDIT.md`: a progress note (T-03 implemented, not reviewed or
  deployed) and the guide's section reference.
- Story cards SF-012, SF-013, SF-017, SF-021, SF-022, SF-023, SF-028, SF-029: "Follow-ups from T-03"
  sections (no acceptance criteria changed).
- Second session: `FIRESTORE_RULES.md` section 2 (status: 15/15; the emulator download; what to
  do if a run stops after a rules edit, L13); `PRODUCTION_AUDIT.md` progress note; SF-021's
  follow-up (the run happened); SF-022 and SF-023 follow-ups (L13).

## Open limitations and follow-ups

- **L1: resolved in the second session.** The rules pass 15/15 on the emulator, and the
  non-Latin limits hold (D2). What remains is the real project: PC-002 after the owner's deploy.
- **L2: the Docker image hasn't been built.** The real server and config were tested on the
  exact file set, but the `.dockerignore` allowlist, which re-includes a file inside an excluded
  folder (`!.well-known/assetlinks.json`), relies on BuildKit behaviour not tried here. Railway's
  first build is the first real one (PC-003).
- **L3: a first launch with no connection and no service worker yet** shows the browser's own
  offline page: the page itself can't load, so neither can the panel. The panel covers a page
  that loads without its SDK (R4) or loads slowly (F9). The card's "clear site data, go Offline,
  load" works only when the browser's HTTP cache still holds the page, which `no-cache` prevents.
- **L4: installed PWA and TWA behaviour was injected, not observed** (F7, F8) → check inside the
  real TWA in SF-012 (noted on its card).
- **L5: Caddy's 404 responses lack the three headers** (its error path skips `header`). Nothing
  is served on them.
- **L6: installing a new worker needs gstatic reachable** (or the SDK in the HTTP cache); if not,
  the old worker stays until a later visit.
- **L7: "N changes waiting" is a lower bound** when deletes are pending (D12).
- **L8: the Firebase SDK's own console warnings are not filtered,** and the real SDK's console
  output (run R) was captured but not inspected in this session. The app's own lines were
  checked (F3–F5).
- **L9: the form checks still use `alert()`** → SF-028.
- **L10: deploy the web app before the rules.** An old page (GitHub Pages, v2) has no
  `maxlength`, so a long name or description would be refused with a raw error there
  (`FIRESTORE_RULES.md` says so).
- **L11: resolved in the second session:** `package-lock.json` exists (D5).
- **L12: online but Firestore unreachable (for example a blocking network) shows "connecting…",
  not "offline".** Honest, but not specific.
- **L13: `npm run test:rules` can abort right after `firestore.rules` is edited.**
  `firebase-tools` watches the rules file that `firebase.json` names. With BR3's edit, the
  watcher fired as the emulator started ("Change detected, updating rules…"), pushed the rules
  before the emulator was listening, and the run stopped with "Failed to make request to
  …:securityRules". The emulator's `java` process stayed on port 8080, so the next run said "port
  taken". It happened on 4 of 4 BR3 attempts (in the repo and in a copy outside OneDrive) and
  once for BR2; never for the unmodified file. The cause wasn't found. It affects the tool, not
  the rules: the test file uploads the rules itself. `FIRESTORE_RULES.md` section 2 says what to
  do. SF-022 and SF-023 (T-04) edit the rules and may meet it; a possible fix there is a
  test-only emulator config without the `rules` entry.
- **T-01 and T-02 are still undeployed;** T-03 would ship with them, taking production from cache
  v2 to v5.
