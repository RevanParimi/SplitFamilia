# Current handoff — 2026-09-29 (IST)

## START HERE — resume checklist, in order

**0. The plan is approved** (`plan_status: approved`). "Continue" means the next step below.

**1. Run due `pending_checks`.** **PC-004 is half done:** commit `6f3b3fe` (T-01 to T-03) was
pushed to `main` at 16:39 IST on 2026-09-29, and step 1 passed at 16:41 IST (the live site serves
v5, byte-identical to the commit). Ask the owner for step 2 (open the family group on the phone)
and record it.
**PC-003 is mostly done:** the Railway service is live at **`https://splitfamilia.up.railway.app`**
(renamed by the owner; recorded in T-05's note). Steps 1, 2 and 5 pass there, and a new test group
reached "· live". Still to ask: step 3 with the family group's own invite link, and step 4 (add
and delete a test expense).

**UI design (SF-028):** the owner designed the look in Claude Design from
`docs/design/CLAUDE_DESIGN_PROMPT.md` (prompt 1, then follow-up 2: more colour, fewer options).
"SplitFamilia Prototype v2" is approved, palette **indigo-saffron**. The export is in the repo
(2026-09-30): `docs/design/DESIGN_NOTES.md` (the spec),
`docs/design/prototype/SplitFamilia-Prototype-v2.html` (a React bundle for viewing only) and
`docs/design/playstore-mockups/` (mock-ups plus a feature graphic with transparency), with
Claude Design's editable sources in `docs/design/source/`; `docs/design/README.md` explains the
folder. SF-028's
and SF-015's cards say how T-04 uses them. Store screenshots still come from the real app. PC-002 (after the
owner's rules deploy) and PC-003 (after the first Railway deploy) wait on owner actions. Ask the
owner only if they say they did one.

**2. One open decision, not blocking:** D-12 (move the app's files into `web/` for a tidier
repo, only after the phones leave GitHub Pages). No task waits on it. `README.md` is now the
repo's map (2026-09-30).

**3. Next: a fresh-session review of T-03** (all five stories, SF-007 to SF-011), with
[REVIEW.md](REVIEW.md), from [evidence/T-03-implementation.md](evidence/T-03-implementation.md).
The review writes `evidence/T-03-review.md` and sets T-03 to `done` or `changes_requested`.
- Verify the input hashes in the receipt first.
- `npm test` → expect 72 passed.
- `npm run test:rules` → expect 15 passed. `node_modules` is installed, and the emulator jar is
  cached. If `java -version` fails in the session's shell, VS Code started before the install:
  prepend `/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin` to `PATH` (Git Bash),
  or restart VS Code.
- Break checks that edit `firestore.rules` may hit L13 (the emulator's watcher aborts the run).
  See the quirks below; the receipt says how BR3 was run.
- The browser check: `node docs/planning/evidence/T-03-browser-check.mjs <repo> <empty scratch dir>`.

**4. The queue** (STATE `tasks[]` order; a task is about five stories):

| Task | Stories | What it delivers | Points | Status |
|---|---|---|---|---|
| T-01 | SF-001 | Balance maths tested without the network | 2 | Done, deployed (PC-004) |
| T-02 | SF-002, 003, 004, 005, 006 | Play account guide, repo safety check, exact-paise money, safe group links | 9 | Done, deployed (PC-004) |
| **T-03** | SF-007, 008, 009, 010, 011 | Database rules, offline start, honest sync status, the SplitFamilia name, Railway hosting files | 9 | **Review required** (already deployed on the owner's word; rules not deployed) |
| T-04 | SF-022, 023, 029, 028, 015 | Edit expenses, settle-ups, recent groups, a polished UI, the store listing | 11 | To do (needs T-03 done) |
| T-05 | SF-012, 013, 014, 016 | The Android app, its signed release build, the build guide, the Play declarations | 11 | To do |
| T-06 | SF-017, 018, 019, 020, 021 | Privacy policy (drafted and published), testing guide, release checklist, final audit | 8 | To do |
| T-07 | SF-030, 024, 025, 026, 027 | **Stretch:** unequal splits, deleting a group, self-hosted fonts, App Check, automatic checks | 11 | Stretch |

**MANUAL ACTION REQUIRED, after T-03 is reviewed (it is already on `main`):** create the
Railway service from `docs/google-play/HOSTING_RAILWAY.md`, then PC-003. SF-012 in T-05 needs the
live address; if it isn't live when T-05 starts, block T-05 with that reason. The rules deploy
(`docs/google-play/FIRESTORE_RULES.md` section 3, then PC-002) needs the web app with T-03 live,
which PC-004 confirms for GitHub Pages; the emulator run has passed. Recommended: wait for T-03's
review before deploying the rules.

**MANUAL ACTION REQUIRED, any time now:** the Play developer account and testers
([PLAY_CONSOLE_SETUP.md](../google-play/PLAY_CONSOLE_SETUP.md)).

**Deployed on 2026-09-29 about 16:40 IST, on the owner's word ("commit and push"):** T-01, T-02
and T-03 in one commit on `main`, taking GitHub Pages from cache v2 to v5. T-03 went out before its
review. If the review requests changes, they ship in a later push (the owner's word again).

## Key facts for the next session

- **IDs:** tasks are `T-nn`; stories keep their `SF-nnn` IDs. T-01's receipts keep the
  `SF-001-*.md` names.
- **The app:** a single-page PWA: `index.html` (a classic start-up script plus the module),
  `money.js`, `group-code.js`, `sync-status.js`, `manifest.json`, `service-worker.js` (cache
  `splitsheet-v5`, imports `?v=5`, and the two Firebase SDK 12.17.1 files) and icons. Hosting:
  `Dockerfile` (Caddy 2.11.4 on Alpine), `.dockerignore`, `Caddyfile`, `railway.json`,
  `.well-known/assetlinks.json` (placeholders). Rules: `firestore.rules`, `firebase.json`.
- **Committed and pushed:** T-01's, T-02's and T-03's work, `package-lock.json` and all the
  planning files, in one commit on `main` after the baseline `8898b50` (`git log -1`). Later
  commits and pushes each need the owner's word. Commits use the owner's GitHub no-reply identity
  (as the earlier commits did), passed per command with `git -c user.name=… -c user.email=…`,
  because this machine has no git identity configured; never a personal email.
  `node_modules/` and `firestore-debug.log` are git-ignored.
- **The T-03 receipt's hashes** are of the working-tree files (LF). Git stores LF, and
  `core.autocrlf=true` would give CRLF on a fresh checkout, so hash the working tree as it stands,
  or `git show HEAD:<file> | sha256sum`.
- **Tests:** `npm test` → 72 (no install, no network). `npm run test:rules` → 15 on the emulator
  (Java 21 and `npm install`, both done on this machine). The emulator transcript and break
  checks are in `evidence/T-03-rules-emulator.txt`.
- **Owner decisions:** TWA; `com.splitfamilia.app`; SplitFamilia; personal Play account; Railway
  in the owner's Pro workspace, free `*.up.railway.app` address (D-10); JDK and Android SDK
  approved (D-8); the owner installed the JDK themselves (D-11).
- **Limits that must agree** (`npm test` checks): `MAX_AMOUNT_PAISE` ↔ the rules' amount; the
  group-code pattern and length ↔ the rules; the page's `maxlength`s (name 60, description 200,
  currency 3) ↔ the rules; the worker's `SHELL` ↔ the `Dockerfile` and `.dockerignore`; the
  worker's `SDK` list ↔ the page's gstatic imports.
- **Open follow-ups** (receipt L2–L13; on story cards where they belong): the Docker image never
  built, Railway's first build is the first (L2); a first launch with no connection and no worker
  shows the browser's own offline page (L3); the TWA behaviour was injected, not observed (L4, on
  SF-012); the emulator watcher after a rules edit (L13, on SF-022 and SF-023); `privacy.html`
  must be added to the Dockerfile (SF-017); `alert()` for form checks (SF-028); N-1 on SF-028.
- **This machine:**
  - Node 24.21, npm 11.19, Python 3.14 and git; Edge and Chrome (headless Edge works for checks);
  - Java 21: Eclipse Temurin 21.0.12.1 in `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`
    (machine `PATH` and `JAVA_HOME` set by the installer);
  - `firebase-tools` 15.32.0 in `node_modules` (use `npx firebase-tools` or the npm scripts); the
    Firestore emulator jar v1.22.0 cached in `%USERPROFILE%\.cache\firebase\emulators`;
  - no Docker or `gh`.
- **Quirks:**
  - In Git Bash, `TZ=Asia/Kolkata date` prints UTC. For IST, use PowerShell:
    `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "India Standard Time")`.
  - **The emulator after a rules edit (L13):** `firebase-tools` may print "Change detected,
    updating rules..." as it starts, fail with "Failed to make request to …:securityRules", and
    leave the emulator's `java` on port 8080 ("port taken" next time). Stop only `java.exe`
    processes whose command line matches `cloud-firestore-emulator`. For break checks, a scratch
    copy (rules, `firebase.json` without `rules`, `package.json`, the test file, a
    `node_modules` junction) avoids the watcher; remove the junction as a link
    (`(Get-Item <path>).Delete()`), never recursively.
  - PowerShell's execution policy blocks `.ps1` files; pass the commands inline with
    `-Command` instead. Don't bypass the policy.
  - Close headless Edge with CDP `Browser.close`. If one gets stuck, stop only the `msedge.exe`
    processes whose command line holds the scratch profile path, never the owner's browser.
  - In headless Edge, CDP's `display-mode` emulation is ignored and an `android-app://`
    referrer is dropped; the T-03 check injects both with `Page.addScriptToEvaluateOnNewDocument`.
  - Pass Windows paths to Node harnesses in a form `path.resolve` agrees with (the T-03 harness
    resolves its argument; a forward-slash path broke an earlier `startsWith` check).
  - Long Python heredocs with mixed quotes can fail in Git Bash ("unexpected EOF"); write the
    script to the scratchpad and run it.

## Last session

- **2026-09-29 16:45 IST to 2026-09-30 (same chat, after the push of `6f3b3fe`):** the owner set
  up Railway (`splitfamilia.up.railway.app`, PC-003 steps 1, 2 and 5 pass), designed the new UI
  in Claude Design (saved in `docs/design/`, palette indigo-saffron, SF-028 and SF-015 cards
  updated), and asked for a tidier repo: `README.md` became the repo map, and moving the app into
  `web/` is D-12. All of it committed and pushed on the owner's word ("commit and push",
  2026-09-30); docs only, no app file changed.

- **2026-09-29, about 16:36–16:45 IST (same chat):** the owner said "commit and push". Staged
  tree scanned first: only the public Firebase web key and Google's placeholder address; one
  personal grep pattern in the T-03 receipt was replaced by a description. T-01 to T-03 committed
  and pushed to `main` (GitHub Pages). PC-004 added for the live check.
- **2026-09-29, about 14:43–15:20 IST:** the owner said "continue" after installing Java 21.
  T-03's implementation finished; status `review_required`. Receipt:
  [evidence/T-03-implementation.md](evidence/T-03-implementation.md) (second-session notes under
  Tests).
  - `npm install`: 729 packages, `package-lock.json` created (all from registry.npmjs.org).
  - `npm run test:rules`: 15/15, twice, with no change to the rules or the tests. The Devanagari
    and emoji names and descriptions are accepted, so the rules' lengths don't count bytes (D2).
  - Emulator break checks 4/4 caught; the rules file restored byte-identical. `npm test` 72/72.
  - Found L13 (the emulator's rules watcher); documented in `FIRESTORE_RULES.md` section 2.
  - Nothing was committed, pushed or deployed.
- **2026-09-29, about 12:21–13:00 IST:** T-03 implemented except SF-007's emulator run (blocked
  on Java, D-11). Browser check, real Caddy headers, 15/15 `npm test` break checks.
