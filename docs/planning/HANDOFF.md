# Current handoff — 2026-09-30 (IST)

## START HERE — resume checklist, in order

**0. T-08 is `done`** (the second fresh review accepted the rework, 2026-09-30 about 19:30 IST).
It is not committed or pushed yet.
- **First, if the owner gives the word: commit and push T-08.**
  - A push to `main` is a production deploy (D-5). It opens the API to the internet; the page
    is unchanged.
  - What's uncommitted: all of T-08 and its reviews, the T-03 review files, the re-plan's cards,
    STATE, HANDOFF and the edited docs (see "Committed and pushed" below).
  - Use the owner's GitHub no-reply identity, per command (`git -c user.name=… -c
    user.email=…`). Never a personal email.
  - Right after the push, run **PC-005** steps 1–4 (headers, `/healthz` with
    `"storage":"volume"`, byte-identical files, 404s) and record them.
- **Then T-09's implementation** (`next_task: T-09`, `next_phase: implementation`), in a fresh
  conversation. SF-035, SF-036, SF-037 and SF-038, in that order.
  - Set `active_task` to T-09 and its status to `in_progress` before editing.
  - T-09 needs **D-18** (open). If the owner says "continue" without answering, option (a)
    applies, as it did for D-13 to D-16. Record that in STATE.
  - Read first: the "Follow-up" sections of the SF-038 card (N-5 from the first T-08 review;
    F-10 and N-6 from the second) and SF-037's dry-run list (N-7). SF-035's card carries D2's
    page-side items and the 429 and `group-full` texts. SF-036's card says how the server
    treats a change sent again.
  - SF-037's import runs against production only on the owner's word (migrating data).

**1. Open decisions:**
- **D-18** (needed by SF-038): bound what one read of a large group can cost, before the
  switch-over. Recommended (a):
  - cap a group's split entries at 20,000, deleted ones included;
  - gzip the API's answers;
  - build one answer per group version.

  Measured by the second review: 37.3 MB and 1.74 s per read of a group filled to D-17's caps.
- **D-12** (the app into `web/`, after T-09). No task waits on it.

**2. Pending checks:** none the session can run now. Ask only if the owner says they did one:
- PC-005: right after the owner pushes T-08. The session can run steps 1–4;
- PC-004 step 2 (the family group on the phone);
- PC-003 steps 3 and 4 (the family's invite link on Railway, plus a test expense);
- PC-002 (after the owner publishes the stopgap rules, D-15).

**MANUAL ACTION REQUIRED (owner, any time):**
- The word to commit and push T-08 (step 0).
- **D-15:** publish the stopgap Firestore rules ([FIRESTORE_RULES.md](../google-play/FIRESTORE_RULES.md)
  section 3).
- The Play developer account and testers ([PLAY_CONSOLE_SETUP.md](../google-play/PLAY_CONSOLE_SETUP.md)).
- Railway's section 3a steps are all done (2026-09-30: region Southeast Asia, a volume at
  `/data`, daily backups).

**3. The queue** (STATE `tasks[]` order):

| Task | Stories | What it delivers | Points | Status |
|---|---|---|---|---|
| T-01 | SF-001 | Balance maths tested without the network | 2 | Done, deployed |
| T-02 | SF-002, 003, 004, 005, 006 | Play account guide, repo safety check, exact-paise money, safe group links | 9 | Done, deployed |
| T-03 | SF-007, 008, 009, 010, 011 | Firestore rules, offline start, honest sync status, the name, Railway hosting files | 9 | Done; live on Pages and Railway; rules not deployed |
| T-08 | SF-031, 032, 033, 034 | **Railway backend:** Node server, SQLite on a volume, the ledger API, live updates | 9 | **Done; not committed or pushed** |
| **T-09** | SF-035, 036, 037, 038 | **The switch-over:** the page on the API, offline outbox, copying the data, removing Firebase | 9 | **Next** (needs D-18) |
| T-04 | SF-022, 023, 029, 028, 015 | Edit expenses, settle-ups, recent groups, a polished UI, the store listing | 11 | To do (after T-09) |
| T-05 | SF-012, 013, 014, 016 | The Android app, its signed release build, the build guide, the Play declarations | 11 | To do |
| T-06 | SF-017, 018, 019, 020, 021 | Privacy policy, testing guide, release checklist, final audit | 8 | To do |
| T-07 | SF-030, 024, 025, 027 | **Stretch:** unequal splits, deleting a group, self-hosted fonts, automatic checks | 8 | Stretch |

## Key facts for the next session

- **IDs:**
  - Tasks are `T-nn`; stories keep their `SF-nnn` IDs. T-01's receipts keep the `SF-001-*.md`
    names.
  - Review findings are numbered across tasks: F-1 to F-10 and N-1 to N-7 so far.
  - T-08's receipt uses D1–D22, L1–L9 and B1–B20 inside it only. Its first review uses R1–R8
    and P1–P9, and its second review Q1–Q9.
  - STATE decisions are `D-n` (D-18 is not the receipt's D18).
- **The app:**
  - The page: `index.html` (unchanged since T-03), `money.js`, `group-code.js`,
    `sync-status.js`, `manifest.json`, `service-worker.js` (cache `splitsheet-v5`, imports
    `?v=5`, keeps the two Firebase SDK 12.17.1 files) and the icons. **It still uses Firestore
    until T-09.** The worker serves the cached page first and caches every same-origin `GET`,
    so SF-035 must keep `/api/…` out of it (on its card).
  - The server (T-08), in `server/`:
    - `main.js` starts it;
    - `server.js` routes, and refuses dot segments;
    - `static.js` holds the fixed file list, headers, ETag and gzip;
    - `db.js` is `node:sqlite`: STRICT tables, `amount_paise`, `deleted_at` marks,
      `schema_version`;
    - `api.js` holds the endpoints, `X-Group-Code`, the logging rules and the limits:
      - 30 unknown codes per address per 10 minutes, checked again after the body;
      - 300 changes per address per 10 minutes;
    - `live.js` is the event-stream hub: 1000 streams in all, 10 per address.
  - `ledger-rules.js` holds the limits (no imports): 100 people and 100 in a split; 5,000
    expenses per group, deleted ones included; real dates only. `ledger-client.js` has
    `watchGroup()`, `createEventParser()` and `reconnectDelay()`. The page uses both from T-09.
  - Hosting: `Dockerfile` (`node:24.21.0-alpine`, `/app` mirrors the repo, a `package.json` of
    `{ "type": "module" }` written by `RUN`), `.dockerignore`, `railway.json` (health check
    `/healthz`), `.well-known/assetlinks.json` (placeholders). The Caddyfile is deleted, and the
    deletion is staged by `git rm`.
  - Rules: `firestore.rules` and `firebase.json`, until SF-038.
- **Committed and pushed:** everything up to `fa17597`. **Not committed:**
  - all of T-08, its receipt, and both reviews with their probes and outputs
    (`evidence/T-08-*`);
  - the T-03 review files;
  - the 2026-09-30 re-plan (cards SF-031 to SF-038, and the edited cards);
  - STATE, HANDOFF, `REVIEW.md`, `PRODUCTION_AUDIT.md`, `FIRESTORE_RULES.md`,
    `HOSTING_RAILWAY.md`, `README.md` and `CLAUDE.md`.

  Commits and pushes each need the owner's word.
  - This machine has no git identity configured. Commits use the owner's GitHub no-reply
    identity, as the earlier commits did, passed per command. Never a personal email.
  - `node_modules/`, `data/` and `firestore-debug.log` are git-ignored.
- **Hashing:** `core.autocrlf=true`. `index.html` is CRLF on disk but LF in git (N-2). All T-08
  files are LF on disk. The three `T-08-*-output` files written by PowerShell are CRLF with a BOM.
- **Tests:**
  - `npm test` → 140 (no install, no network; Node 24 for `node:sqlite`). The server tests start
    the real server in-process on 127.0.0.1 with a temporary database
    (`tests/helpers/test-server.js`).
  - `npm run test:rules` → 15 on the Firestore emulator (needs Java 21 and `npm install`, both
    done here).
  - `npm start` runs the server locally on http://localhost:8080, with its database in `data/`.
  - Evidence scripts, all run from the repo:
    - `T-08-break-checks.mjs` (20 breaks; it edits files for a few seconds each, so run it
      only with no other session editing);
    - `T-08-review-breaks.mjs` (8);
    - `T-08-review-probe.mjs` and `T-08-review2-probe.mjs` (with `--expose-gc`, about 38 s);
    - `T-08-image-check.mjs <empty dir>` and `T-08-browser-check.mjs <repo> <empty dir>`.
- **Railway facts** (docs checked 2026-09-30):
  - the edge sets `X-Real-IP`, and closes idle HTTP/1.1 connections after 60 s;
  - a response lasts at most 15 minutes if data flows, or 5 minutes without data;
  - volumes mount as root, and a service with a volume has a few seconds of downtime per deploy
    (no replicas);
  - a Pro volume is 50 GB and can be resized; the docs don't mention usage alerts;
  - `splitfamilia.up.railway.app` has no AAAA record, so clients arrive over IPv4 only (checked
    with three resolvers).
- **Owner decisions:**
  - Android: a TWA, package `com.splitfamilia.app`, named SplitFamilia; a personal Play
    account.
  - Railway in the owner's Pro workspace, at `https://splitfamilia.up.railway.app` (D-10).
  - D-13 to D-16 were taken by default; D-17 was the owner's (a). Old-style group codes stay
    guessable (D-4; N-3).
- **Limits that must agree** (`npm test` checks):
  - `MAX_AMOUNT_PAISE`: `money.js`, `ledger-rules.js` and the rules;
  - the group-code pattern and length: `group-code.js` and the rules;
  - the page's `maxlength`s (name 60, description 200, currency 3): `ledger-rules.js` and the
    rules;
  - the split, at most 100: `ledger-rules.js` and the rules. The page doesn't check it until
    SF-035;
  - at most 100 people and 5,000 expenses in a group: the server only, since Firestore rules
    can't count. The page checks them from SF-035;
  - the worker's `SHELL`: `server/static.js`, the `Dockerfile` and `.dockerignore`;
  - the worker's `SDK` list: the page's gstatic imports.
- **Open follow-ups elsewhere:**
  - The `?g=` code in the page's URL may reach Railway's request log (SF-035 card, owner
    confirmation before any link change).
  - Deleted entries stay in the database until the group is deleted (SF-017, SF-024 cards).
  - A first launch with no connection and no worker shows the browser's own offline page (L3 of
    T-03).
  - The TWA behaviour was injected, not observed (L4, on SF-012).
  - `privacy.html` must be added to the Dockerfile and to `server/static.js` (SF-017).
  - GitHub Pages serves every repo file, docs included, until the owner turns it off.
- **This machine:**
  - Node 24.21.0, npm 11.19, Python 3.14 and git; Edge and Chrome (headless Edge works for
    checks);
  - Java 21 (Temurin) in `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`. If Git
    Bash doesn't see it, prepend its `bin` to `PATH`;
  - `firebase-tools` 15.32.0 in `node_modules`; no Docker or `gh`.
- **Quirks:**
  - For IST, use PowerShell:
    `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "India Standard Time")`.
  - This session's command check sometimes gave no verdict. Retrying later, or using PowerShell
    instead of Bash, worked.
  - A long Bash heredoc was cut off partway (the file got half the text). Append long text with
    the file editor instead.
  - Windows refuses some of several hundred connections opened at once. Open them one by one
    when a probe needs many held requests.
  - A test that leaves a `watchGroup()` running never lets its process exit. Stop every watch in
    `finally`. The break script gives each run a time limit.
  - Node's `fetch` (undici) opens a spare connection that never sends a request. The server's
    `close()` closes such connections at once.
  - Emulator quirks, from T-03:
    - after a rules edit, use a scratch copy (L13);
    - delete `firestore-debug.log` afterwards;
    - stop only the `java.exe` processes whose command line matches `cloud-firestore-emulator`.
  - Close headless Edge with CDP `Browser.close`. Its offline emulation doesn't cover the
    browser's own worker-update check, so stop the server to prove an offline start.
  - PowerShell's execution policy blocks `.ps1` files; pass commands inline.

## Last session

- **2026-09-30, about 18:40–19:30 IST: T-08's second fresh review, of the rework: `accepted`.**
  The owner said "continue". Receipt: [evidence/T-08-review.md](evidence/T-08-review.md),
  section "Second review: the rework".
  - The input matched: 26 hashes, all LF; the page files equal `HEAD`.
  - Results:
    - `npm test` 140/140;
    - break checks 20/20 and R1–R8 caught, every file restored;
    - the first review's probe re-run: P1 30 × 404 and 30 × 429; P8 199 accepted, then 429;
    - the image and browser checks re-run, with the same results.
  - The new probe (`T-08-review2-probe.mjs`):
    - 400 held bodies at the real change limit: 298 accepted, 102 × 429;
    - no 429 or 503 reveals whether a code exists;
    - replays into a group full at 5,000 succeed without changing it;
    - `isDate` matches an independent calendar on 90,552 strings;
    - no log line holds a code or an address;
    - Railway is IPv4-only.
  - **F-10 (medium, D-18):** one read of a group filled to the caps is 37.3 MB and 1.74 s, and
    ten of them held `/` for 16.7 s. It goes to SF-038, before the switch-over.
  - N-6 (the change limit is a rate, about 590 MB a day from one address) went to SF-038. N-7
    (the dry run misses the 5,000 cap) went to SF-037, whose card is updated.
  - Nothing was committed or pushed.
- **2026-09-30, about 17:55–18:15 IST: T-08's rework, in the same conversation as its first
  review, on the owner's word** ("ya go as per recommendations": D-17 option (a)). F-8 fixed;
  300 changes and 10 streams per address; 5,000 expenses per group; impossible dates refused.
- **2026-09-30, ending about 17:50 IST: T-08's first fresh review, `changes_requested`** (F-8
  high, F-9 medium with D-17, N-4, N-5).
- **2026-09-30, about 11:15–12:20 IST: T-08 implementation.** The owner's limits of 100 people
  and 100 in a split came during it. The owner's Railway steps (region, volume, backups) were
  done by about 13:00 IST.
- **2026-09-30, about 07:10–07:25 IST: re-plan for the move to Railway** (T-08, T-09 and
  SF-031 to SF-038, before T-04; SF-026 dropped; D-13 to D-16 opened).
- **2026-09-30, about 06:43–07:05 IST: T-03's fresh review, accepted** (F-5 to F-7, N-2, N-3).
- **2026-09-29:** T-01 to T-03 pushed (`6f3b3fe`); Railway set up; the UI designed; README and
  the design committed (`fa17597`).
