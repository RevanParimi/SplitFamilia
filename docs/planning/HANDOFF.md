# Current handoff — 2026-09-30 (IST)

## START HERE — resume checklist, in order

**0. Next: T-09's switch-over, on the owner's word, one step at a time.** T-09 is `done`: a fresh
review accepted it on 2026-09-30 ([evidence/T-09-review.md](evidence/T-09-review.md)). Follow
[MOVE_FROM_FIREBASE.md](../google-play/MOVE_FROM_FIREBASE.md), and ask for the owner's word before
each push, the token, the rules change and the copy:
1. **Push A: done.** Committed as `db540e7` and pushed 2026-09-30 at 23:58 IST, on the owner's
   word. PC-006 steps 1–3 passed ([output](evidence/T-09-pc006-output.txt)).
   - Everything else in the working tree belongs to push B: the deletions, the page, the docs,
     and the review's and PC-006's files.
2. **The token (guide step 2): done** on 2026-10-01 about 00:20 IST. `data/import-token.txt` and
   `data/move-codes.txt` (3 codes) exist, git-ignored; `IMPORT_TOKEN` is set in Railway. PC-006
   steps 4–5 passed (`GET /api/import` 405). Never print the token or send it from the session
   except in the copy itself.
3. **PC-006 step 6 and guide step 3: done** (the owner, about 00:24 IST): every phone "· live" on
   the old app, then the read-only rules published. PC-006 is complete.
4. **The dry run: done** (00:24 IST). Group 2, the family's: 9 people, 26 expenses. Group 1: 1
   person. Group 3: empty. Nothing left out or over the limits; every balance kept. The report
   is `data/move-report-2026-09-30T18-54-26-891Z.txt`.
5. **The copy: done** (about 00:32 IST, run by the owner in their own terminal, because Claude
   Code's permission check refused it to the session). All 3 groups showed "MATCH", ending
   "Every balance matches to the paisa." The session's own read-back agreed.
6. **Push B:** on the owner's word ("i want you to do these things"), then PC-007 (with an
   optional step 5: an offline open on a real phone).
7. Guide steps 6–8: the owner removes `IMPORT_TOKEN`, moves the phones, and after 7 days turns
   off GitHub Pages and deletes the Firebase project.

**After push B, T-04's implementation** in its own conversation (`next_task` T-04,
`next_phase` implementation). T-04's SF-022 now carries F-11 and F-12, and SF-028 carries N-8.
Starting T-04 before push B would mix its changes into T-09's uncommitted files, so don't.

**1. Open decisions:** only **D-12** (the app into `web/`, after the switch-over's last step).
No task waits on it.

**2. Pending checks:**
- PC-005 (T-08's push, `a8bffb8`): steps 2–4 passed on 2026-09-30 about 20:32 IST. It still
  waits on the owner for step 1 (the deploy log line) and step 5 (the family group opens on the
  Railway address, with "· live"). Ask; record the answer in PC-005.
- PC-006 (after push A; step 6 before guide step 3) and PC-007 (after push B).
- PC-004 step 2 and PC-003 steps 3 and 4: ask only if the owner says they did them.
- PC-002 lapses at the switch-over (the stopgap rules were never published).

**MANUAL ACTION REQUIRED (owner):**
- The switch-over's steps above, starting with the word for push A.
- PC-005 steps 1 and 5.
- `node_modules/` holds the old Firebase tools. It's git-ignored and unused now, so the folder
  can be deleted.
- The Play developer account and testers ([PLAY_CONSOLE_SETUP.md](../google-play/PLAY_CONSOLE_SETUP.md)).

**3. The queue** (STATE `tasks[]` order):

| Task | Stories | What it delivers | Points | Status |
|---|---|---|---|---|
| T-01 | SF-001 | Balance maths tested without the network | 2 | Done, deployed |
| T-02 | SF-002, 003, 004, 005, 006 | Play account guide, repo safety check, exact-paise money, safe group links | 9 | Done, deployed |
| T-03 | SF-007, 008, 009, 010, 011 | Firestore rules, offline start, honest sync status, the name, Railway hosting files | 9 | Done; live; rules never deployed (removed in T-09) |
| T-08 | SF-031, 032, 033, 034 | Railway backend: Node server, SQLite on a volume, the ledger API, live updates | 9 | Done; live as `a8bffb8` (PC-005 steps 1 and 5 open) |
| **T-09** | SF-035, 036, 037, 038 | **The switch-over:** the page on the API, offline outbox, copying the data, removing Firebase | 9 | **Done (accepted); the switch-over is next** |
| T-04 | SF-022, 023, 029, 028, 015 | Edit expenses, settle-ups, recent groups, a polished UI, the store listing | 11 | To do (after push B) |
| T-05 | SF-012, 013, 014, 016 | The Android app, its signed release build, the build guide, the Play declarations | 11 | To do |
| T-06 | SF-017, 018, 019, 020, 021 | Privacy policy, testing guide, release checklist, final audit | 8 | To do |
| T-07 | SF-030, 024, 025, 027 | **Stretch:** unequal splits, deleting a group, self-hosted fonts, automatic checks | 8 | Stretch |

## Key facts for the next session

- **IDs:**
  - Tasks are `T-nn`; stories keep their `SF-nnn` IDs. T-01's receipts keep the `SF-001-*.md`
    names.
  - Review findings are numbered across tasks: F-1 to F-13, N-1 to N-12, and O-1 to O-2 so far.
  - T-09's receipt uses D1–D10, L1–L6, C1–C22 (break checks) and B1–B8 (browser check). Its
    review uses P1–P4 and R1–R7 (probe) and RB1–RB7 (break checks).
  - STATE decisions are `D-n`.
- **T-09's review follow-ups:**
  - F-11 and F-12 (low) → SF-022; F-12 also → SF-024.
  - F-13 (low): two copy-path guards have no test. If the script or the import changes
    before the copy, add tests (RB6, RB7).
  - N-8 → SF-028. N-9, N-10 and N-12 need nothing now; tidy `.gitignore`'s Firebase lines at
    D-12.
- **The app now (in the working tree; live is still `a8bffb8`'s Firestore page):**
  - The page: `index.html` and six import-free modules at `?v=6`:
    - `money.js`;
    - `group-code.js` (with `movedLink` and `HOME`);
    - `sync-status.js`;
    - `ledger-rules.js`;
    - `ledger-client.js` (`request`, `getGroup`, `sendChange`, `watchGroup`);
    - `outbox.js` (the outbox and the IndexedDB store).

    Also `service-worker.js` (`splitsheet-v6`; never `/api/`), `manifest.json` and the icons.
  - The server, in `server/`:
    - `main.js`, `server.js` (`/healthz` 503 without a database), `static.js` (a fixed list of
      the page's 12 files);
    - `db.js` (with `importGroup` and `splitEntryCount`);
    - `api.js`: the endpoints, `POST /api/import` behind `IMPORT_TOKEN`, the limits, and the
      shared, gzipped group answers;
    - `live.js`.
  - Limits: 100 people and a split of 100; 5,000 expenses and 20,000 split entries per group;
    per address, 30 unknown codes and 300 changes per 10 minutes, and 10 streams.
  - `scripts/move-from-firestore.mjs` (not shipped): the switch-over's copy. It reads the codes
    and the token from `data/` files.
  - Firebase is gone from the repo (no rules, settings, SDK, dependencies or `test:rules`).
    `npm test` checks that nothing shipped mentions it.
- **Committed and pushed:** everything up to `a8bffb8` (T-08 with its reviews, the re-plan, the
  docs), and **push A, `db540e7`** (T-09's server part; live since 2026-09-30 23:58 IST).
  **Not committed:** the rest of T-09 (push B) with its review, the PC-005 and PC-006
  evidence, STATE and HANDOFF. Commits and pushes each need the owner's word.
  - This machine has no git identity configured. Commits use the owner's GitHub no-reply
    identity (the same as `a8bffb8`), passed per command with `git -c user.name=… -c
    user.email=…`. Never a personal email.
  - Push B, after the copy: `git add -A` the rest, check `git diff --cached --name-only` (no
    `data/` file, no token), commit and push on the owner's word, then PC-007.
- **Hashing:** `core.autocrlf=true`. `index.html` is CRLF on disk but LF in git (N-2). On this
  machine `git archive` writes CRLF files; compare with `tr -d '\r'`.
- **Tests:**
  - `npm test` → 180 (no install, no network; Node 24 for `node:sqlite`).
  - `npm start` runs the server on http://localhost:8080 with its database in `data/`.
- **Railway facts** (docs checked 2026-09-30):
  - the edge sets `X-Real-IP`, and closes idle HTTP/1.1 connections after 60 s;
  - a response lasts at most 15 minutes if data flows, or 5 minutes without data;
  - volumes mount as root; a service with a volume has a few seconds of downtime per deploy;
  - a Pro volume is 50 GB, resizable, with no usage alerts in the docs;
  - the host has no AAAA record (IPv4 only).
  - The live service redeployed about 30 s after the T-08 push.
- **Owner decisions:**
  - Android: a TWA, package `com.splitfamilia.app`, named SplitFamilia; a personal Play
    account.
  - Railway in the owner's Pro workspace, at `https://splitfamilia.up.railway.app` (D-10).
  - D-13 to D-16 by default; D-17 (a) and D-18 (a) on the owner's word.
  - Old-style group codes stay guessable (D-4; N-3).
- **Open follow-ups elsewhere:**
  - `#g=` invite links (SF-035, **OWNER CONFIRMATION REQUIRED**).
  - Deleted entries stay until the group is deleted (SF-017, SF-024).
  - The TWA behaviour was injected, not observed (L4 of T-03, on SF-012).
  - `privacy.html` must be added to the Dockerfile and `server/static.js` (SF-017).
- **This machine:**
  - Node 24.21.0, npm 11.19, Python 3.14 and git; Edge and Chrome (headless Edge works for
    checks, and `--host-resolver-rules` can map a made-up host to 127.0.0.1);
  - Java 21 (Temurin); no Docker or `gh`.
  - Headless Edge loads a 1Password extension (by policy). Its console lines show up in CDP
    captures; ignore them.
- **Quirks:**
  - For IST, use PowerShell:
    `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "India Standard Time")`.
  - Long Bash heredocs and `node -e` scripts with regexes get mangled. Write a script file to
    the scratchpad, then run it.
  - A plain `grep -r` walks `node_modules/` and times out. Use the Grep tool, which skips
    ignored folders.
  - Windows refuses some of several hundred connections opened at once. Open them one by one in
    probes.
  - A test that leaves a `watchGroup()` running never lets its process exit. Stop every watch in
    `finally`.
  - Close headless Edge with CDP `Browser.close`. Its offline emulation doesn't cover the
    browser's own worker-update check, so stop the server to prove an offline start.
  - **CDP: don't pause new targets** (`waitForDebuggerOnStart: false`), and put a time limit on
    every reply. With workers paused on start, replies sometimes never came (O-2): a run hung,
    and a navigation fell through to Edge's offline page. `T-09-review-probe.mjs` shows the
    pattern.
  - Background runs of headless Edge: stop leftovers by command line (`*t09-review-*` or the
    scratch profile), never all `msedge` processes; the owner's own Edge is running.
  - PowerShell's execution policy blocks `.ps1` files; pass commands inline.

## Last session

- **2026-09-30, about 23:57 IST to 00:03 IST: push A**, on the owner's word ("go ahead commit
  and push"). `db540e7`: exactly the guide's 10 files, matching the review's hashes; that tree
  passed 155/155. Railway redeployed about 30 s after the push, with a two-second gap. PC-006
  steps 1–3 passed. Push B is not pushed.
- **2026-09-30, about 22:45 IST to midnight: T-09's fresh review, accepted.**
  - Input: 33 hashes verified. `npm test` 180/180. C1–C22 22/22 caught. The review's RB1–RB5
    were caught; RB6 and RB7 were missed (F-13).
  - Push A alone passed 155/155, with the page files equal to `HEAD`. Image checks gave 19 and
    17 files.
  - The browser check's B1–B8 held, reworked by hand for the run's ID order. Its first run
    stopped on a CDP stall (O-2).
  - Read cost: 5.2 MB, 1.3 MB gzipped; `/` held 30 ms.
  - The review's probe ([output](evidence/T-09-review-probe-output.json)) covered:
    - the import token;
    - a copy with a removed person's share, which matched to the paisa;
    - a copy run again after changes on Railway: nothing added, no deleted row back, and
      "matches" refused;
    - a group started offline and reloaded offline, which went live at version 3;
    - two tabs with a refusal in the middle of the queue: both ended "live" with the balances
      worked out by hand, and each change was sent once;
    - offline opens, a lookalike host, and clean logs.
  - New: F-11, F-12, F-13 (all low); N-8 to N-12; O-2. PC-006 gained step 6; PC-007 gained an
    optional step 5.
  - Nothing committed or pushed.
- **2026-09-30, about 18:40–22:40 IST:** T-08's second review (accepted), T-08's push
  (`a8bffb8`, PC-005 steps 2–4 passed), D-18 answered (a), and T-09's implementation.
- **2026-09-30, earlier:** T-08's first review (`changes_requested`) and rework; T-08's
  implementation; the re-plan for the move to Railway; T-03's review (accepted).
- **2026-09-29:** T-01 to T-03 pushed (`6f3b3fe`); Railway set up; the UI designed (`fa17597`).
