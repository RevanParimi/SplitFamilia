# Current handoff — 2026-10-01 (IST)

## START HERE — resume checklist, in order

**0. T-04 is reviewed and accepted, but not deployed** (`active_task` T-04, status `done`,
production `pending_deployment`; `next_task` T-05, `next_phase` implementation). Review receipt:
[evidence/T-04-review.md](evidence/T-04-review.md).
- **Nothing is committed or pushed.** The working tree holds T-04's code, tests, docs and
  evidence, its review's files, and the earlier sessions' uncommitted record updates
  (`STATE.json`, `HANDOFF.md`, `CLAUDE.md`, `README.md`, `evidence/T-09-pc007-*`). `data/` and
  `node_modules/` are git-ignored.
- **Next, only on the owner's word:** commit the whole working tree and push to `main`. The push
  is a production deploy: Railway rebuilds and runs migration 2 once at start. Then run **PC-009**
  straight away (health, the v7 files byte-identical, and the edit route: `PUT
  /api/expenses/<id>` answers 404 for an unknown code, where the live server answers 405 today).
  The review rehearsed PC-009's steps 3–4 locally (P7), and its pass rule matches the code.
- **Then T-05** (the Android app) in a **new conversation**.
- **STRICT RULE (the owner, 2026-10-01): never give the owner duties on family members' phones.**
  The owner handles family phones themselves. Don't list, track or assign per-phone steps
  anywhere.
- **Still the owner's (MANUAL ACTION REQUIRED), only in their own accounts:** PC-008 on or after
  2026-10-08 00:35 IST: turn off GitHub Pages and delete the Firebase project (MOVE_FROM_FIREBASE
  step 8). Remind them then. Keep `data/move-report-*.txt` until then.

**1. Open decisions:**
- **D-12:** the app into `web/`, after PC-008. No task waits on it. (That is the only open one.)

**2. Pending checks:**
- **PC-009:** right after the push of T-04 (see 0).
- **PC-008** (2026-10-08 or later): GitHub Pages off and the Firebase project deleted.
- **PC-005** (T-08's push): steps 2–4 passed; T-09's PC-006 and PC-007 since covered steps 1 and
  5. Ask the owner once, then close it.
- PC-004 step 2 and PC-003 steps 3 and 4: ask only if the owner says they did them.
- PC-002 has lapsed: the stopgap rules were never published, and Firestore is read-only.

**MANUAL ACTION REQUIRED (owner):**
- The word to commit and push T-04 (see 0).
- The PC-008 steps under 0.
- `node_modules/` holds the old Firebase tools. It's git-ignored and unused, so the folder can be
  deleted.
- The Play developer account and testers ([PLAY_CONSOLE_SETUP.md](../google-play/PLAY_CONSOLE_SETUP.md)).
- Later, from the listing draft: the category (OWNER CONFIRMATION REQUIRED, Finance recommended),
  a support email and website, and uploading the graphics
  ([STORE_LISTING.md](../google-play/STORE_LISTING.md)).

**3. The queue** (STATE `tasks[]` order):

| Task | Stories | What it delivers | Points | Status |
|---|---|---|---|---|
| T-01 | SF-001 | Balance maths tested without the network | 2 | Done, deployed |
| T-02 | SF-002, 003, 004, 005, 006 | Play account guide, repo safety check, exact-paise money, safe group links | 9 | Done, deployed |
| T-03 | SF-007, 008, 009, 010, 011 | Firestore rules, offline start, honest sync status, the name, Railway hosting files | 9 | Done; live; rules never deployed (removed in T-09) |
| T-08 | SF-031, 032, 033, 034 | Railway backend: Node server, SQLite on a volume, the ledger API, live updates | 9 | Done; live as `a8bffb8` |
| T-09 | SF-035, 036, 037, 038 | The switch-over: the page on the API, offline outbox, copying the data, removing Firebase | 9 | Done; live as `db0580b` |
| T-04 | SF-022, 023, 029, 028, 015 | Edit expenses, settle-ups, recent groups, the new UI, the store listing | 11 | **Done (accepted 2026-10-01); waits for the owner's push, then PC-009** |
| **T-05** | SF-012, 013, 014, 016 | **The Android app, its signed release build, the build guide, the Play declarations** | 11 | **Next: to do** |
| T-06 | SF-017, 018, 019, 020, 021 | Privacy policy, testing guide, release checklist, final audit | 8 | To do (SF-018 carries F-14 and N-14) |
| T-07 | SF-030, 024, 025, 027 | **Stretch:** unequal splits, deleting a group, self-hosted fonts, automatic checks | 8 | Stretch |

## Key facts for the next session

- **IDs:**
  - Tasks are `T-nn`; stories keep their `SF-nnn` IDs. T-01's receipts keep the `SF-001-*.md`
    names.
  - Review findings are numbered across tasks: F-1 to F-14, N-1 to N-16, and O-1 to O-3 so far.
    The next review continues from F-15, N-17 and O-4.
  - T-04's receipts use D1–D12 (decisions), C1–C24 and R1–R16 (break checks), B0–B17 (browser
    check) and P1–P7 (the review's probe).
  - STATE decisions are `D-n` (D-19 is the newest, answered).
- **The T-04 review (accepted):**
  - **F-14 (low):** the message bar (`#notice`) sits outside the `<dialog>` sheets, so a message
    raised while a sheet is open is hidden and inert until the sheet closes. Fix on SF-018: show
    the bar in the top layer; re-run P4 of `evidence/T-04-review-probe.mjs`.
  - **N-14:** `openExpense`/`openPay` state is reset by the previous sheet's close hook (only
    reachable without `showModal`); on SF-018, optional.
  - N-13 (two stale hash rows in T-04's receipt), N-15 (a delete beaten by another phone's edit
    changes nothing, silently), N-16 (the IndexedDB store runs only in browser checks) and O-3
    (`T-04-make-icons.mjs` rewrites the repo's icons; they come out byte-identical): no change.
- **What T-04 changed (accepted, not deployed):**
  - **The page:** `index.html` rebuilt to the approved indigo-saffron design. It has sheets
    (`<dialog>`), a group menu, a guide for new groups, confirmations and field errors (no
    `alert()`). Sync and the outbox are unchanged. It has seven import-free modules at `?v=7`:
    `money.js`, `group-code.js` (+ `groupName`, N-1 trimming), `sync-status.js`,
    `ledger-rules.js` (+ `SETTLEMENT`), `ledger-client.js` (+ `expense-edit`), `outbox.js`
    (+ edits, `deleteCopy`) and **`recent-groups.js`** (new).
  - The worker cache is `splitsheet-v7`. `manifest.json` has theme `#4F46E5` and background
    `#FFFFFF`. The three icons are the owner's own image (D-19).
  - **The server:** `PUT /api/expenses/<old id>` (an edit: the old row marked deleted, the new one
    added under a new ID; 409 `gone` if the old one was already deleted or edited; a resend
    succeeds). Migration 2 adds `expenses.kind` ('settlement' or NULL); `checkExpense` takes an
    optional `kind: "settlement"` paid to exactly one other person.
  - **Old pages and rolling back** (checked by the review, P1 and P2): a v6 page on the new
    server shows settle-ups as "Payment" with the same balances, and `db0580b`'s server runs on
    a database with migration 2.
  - **On the phone:** `localStorage` has `splitfamilia-recent` (up to 20 codes and their
    last-opened times; `invite: true` for a group started on this phone until its link is
    copied).
  - **The T-09 review's follow-ups, done:** F-11, F-12 and N-8. Not done: F-13 (two copy-path
    guards; only if the move script changes), and N-9, N-10 and N-12 need nothing.
- **Store (SF-015):** `docs/google-play/STORE_LISTING.md` and `docs/google-play/assets/` (seven
  1,080 × 1,920 real-app screenshots, a 24-bit feature graphic, the requirements checked
  2026-10-01 IST). Re-make the screenshots after a UI change with
  `evidence/T-04-store-shots.mjs`.
- **Committed and pushed:** everything up to `db0580b` (T-09 push B, 2026-10-01). Commits and
  pushes each need the owner's word. This machine has no git identity: commits use the owner's
  GitHub no-reply identity (as in `db0580b`), passed per command with `git -c user.name=… -c
  user.email=…`. Never a personal email.
- **Hashing:** `core.autocrlf=true`. Since T-04 every file is LF on disk (`index.html` was CRLF
  before; N-2). On this machine `git archive` writes CRLF files; compare with `tr -d '\r'`.
- **Tests:**
  - `npm test` → 214 (no install, no network; Node 24 for `node:sqlite`).
  - `npm start` runs the server on http://localhost:8080 with its database in `data/`.
  - Browser checks: `evidence/T-04-browser-check.mjs` (B0–B17) and
    `evidence/T-04-review-probe.mjs` (P1–P7; needs a `git archive db0580b` copy with LF endings
    plus `recent-groups.js`). The page's logic is only exercised there, not by `npm test`.
- **Railway facts** (docs checked 2026-09-30):
  - the edge sets `X-Real-IP`, and closes idle HTTP/1.1 connections after 60 s;
  - a response lasts at most 15 minutes if data flows, or 5 minutes without data;
  - volumes mount as root; a service with a volume has a few seconds of downtime per deploy;
  - a Pro volume is 50 GB, resizable, with no usage alerts in the docs;
  - the host has no AAAA record (IPv4 only).
  - The live service redeployed about 30 s after each push so far.
- **Owner decisions:**
  - Android: a TWA, package `com.splitfamilia.app`, named SplitFamilia; a personal Play
    account.
  - Railway in the owner's Pro workspace, at `https://splitfamilia.up.railway.app` (D-10).
  - D-13 to D-16 by default; D-17 (a) and D-18 (a) on the owner's word; D-19 the owner's icon.
  - Old-style group codes stay guessable (D-4; N-3).
- **Open follow-ups elsewhere:**
  - `#g=` invite links (SF-035, **OWNER CONFIRMATION REQUIRED**).
  - Deleted (and edited) entries stay until the group is deleted (SF-017, SF-024).
  - The TWA behaviour was injected, not observed (L4 of T-03, on SF-012).
  - `privacy.html` must be added to the Dockerfile and `server/static.js` (SF-017, SF-018; the
    new UI's places for the link are in SF-018's T-04 note). SF-018 also carries F-14 and N-14.
- **This machine:**
  - Node 24.21.0, npm 11.19, Python 3.14 (no PIL) and git; Edge and Chrome (headless Edge works
    for checks, and `--host-resolver-rules` can map a made-up host to 127.0.0.1);
  - Java 21 (Temurin); no Docker or `gh`.
  - Headless Edge loads a 1Password extension (by policy). Its console lines show up in CDP
    captures; ignore them.
- **Quirks:**
  - For IST, use PowerShell:
    `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "India Standard Time")`.
  - Long Bash heredocs and `node -e` scripts with regexes get mangled. Write a script file to
    the scratchpad, then run it. In Python, a `\b` in a normal string is a backspace character:
    use raw strings for regexes written into JS files.
  - A plain `grep -r` walks `node_modules/` and times out. Use the Grep tool, which skips
    ignored folders.
  - Windows refuses some of several hundred connections opened at once. Open them one by one in
    probes.
  - A test that leaves a `watchGroup()` running never lets its process exit. Stop every watch in
    `finally`.
  - Close headless Edge with CDP `Browser.close`. Its offline emulation doesn't cover the
    browser's own worker-update check, so stop the server to prove an offline start.
  - **CDP: don't pause new targets** (`waitForDebuggerOnStart: false`), and put a time limit on
    every reply (O-2).
  - CDP with two tabs: `Page.bringToFront` before a screenshot (a background tab's capture hangs)
    and before using the clipboard (only the front page may).
  - A live stream's response never "finishes": count streams when the request arrives.
  - CDP screenshots are 24-bit RGB PNGs (no alpha), which Play accepts as they are.
  - Background runs of headless Edge: stop leftovers by command line (the scratch profile),
    never all `msedge` processes; the owner's own Edge is running.
  - The break-check scripts edit source files for a few seconds each: never run them while a
    browser check serves the same files.
  - PowerShell's execution policy blocks `.ps1` files; pass commands inline.

## Last session

- **2026-10-01, about 15:22–15:50 IST: T-04's fresh review**, on the owner's "start T-04's
  review". Verdict **accepted**; T-04 `done`, production `pending_deployment`.
  - Input verified (37/39 hash rows; two docs edited in the D-19 fold-in, N-13). `npm test`
    214/214; C1–C24 24/24; the review's R1–R16 14/16 (R12 expected, R14 redundant code);
    browser check B0–B17 identical to the receipt's; contrast 33/33; icons byte-identical; the
    store listing's references and counts checked.
  - The review's probe P1–P7: rollback, a v6 page on the new server, hostile text at 360 px, an
    offline edit beaten by a delete, a removed group's waiting change, a settle-up recorded and
    edited offline, and PC-009 rehearsed.
  - New: F-14 (low) and N-14 to SF-018. Nothing committed or pushed.
- **2026-10-01, about 10:22–11:20 and 15:15–15:25 IST: T-04's implementation**, then D-19 (the
  owner's icon image) folded in.
- **2026-10-01, about 00:20–10:15 IST: the switch-over (T-09).** Push B `db0580b` went live at
  00:35 IST, PC-007 passed, `IMPORT_TOKEN` deleted (10:05 IST), the owner's phone on the
  installed app, "· live".
- **2026-09-30:** T-09's review (accepted) and push A `db540e7`; T-08's reviews, push
  (`a8bffb8`) and D-18; T-09's implementation; the re-plan for Railway; T-03's review.
- **2026-09-29:** T-01 to T-03 pushed (`6f3b3fe`); Railway set up; the UI designed (`fa17597`).
