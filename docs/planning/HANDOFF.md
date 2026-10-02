# Current handoff — 2026-10-02 (IST)

## START HERE — resume checklist, in order

**0. T-06 is done: its second fresh review accepted the rework** (2026-10-02, about 07:54–08:15
IST; receipt [evidence/T-06-review.md](evidence/T-06-review.md), section "Second review: the
rework"). **Every planned task is now done.** STATE: `active_task` T-06, `next_task` **null**,
`next_phase` null.
- **Next: the owner's word to commit and push T-06.** Nothing from T-06 is committed or pushed. A
  push is a **production deploy**: Railway redeploys about 30 s later. Web files changed:
  `privacy.html`, `index.html`, `service-worker.js` (now `splitsheet-v8`), `server/static.js`,
  `server/api.js`, `server/server.js`, `Dockerfile`, `.dockerignore`, `railway.json`.
  - Before the push, re-check `git show origin/main:service-worker.js` still names
    `splitsheet-v7`. If so, v8 is right and no new bump is needed.
  - Scan what's committed as in T-05's push: no keystore, bundle, build folder, `data/`, email,
    token, key or local path. Never commit `T-06-codes-check.mjs --show` output.
  - Commit with the owner's no-reply identity (as in `cc489a5` and `5f51b22`). Include T-06's
    files, both receipts, the evidence and screenshots, and these record files.
  - Then run **PC-011** at once (session only): `/healthz`, every page file byte-identical to the
    commit, `/privacy.html` 200 with its Draft note, no cookie. Record it in STATE.
  - The privacy page goes live with its "Draft" note. SF-018's gate allows that; PC-010 covers
    the approved version. T-06's `production_verification` stays `pending_deployment` until
    PC-010.
- **If the owner says "continue" without a push word:** there's no task to take (T-07 is stretch).
  Ask once whether to push T-06, and whether to promote T-07. Don't start T-07 on "continue"
  alone.
- **One open note, N-23 (not blocking, on the SF-017 card):** `tests/privacy.test.js` checks the
  live-connection clause once, not in each of sections 5 and 10 (the review's break X6). Fix it
  the next time the policy is edited (PC-010), or with SF-024 or SF-025.
- **D-21 answered (06:12 IST):** the final audit found one of the family's real group codes used
  as a test example, public in every commit since `6f3b3fe`. On the owner's word it was replaced
  by a made-up code in the tree (part of T-06's uncommitted changes, so the review covers it);
  history keeps the old one (accepted). The repo never names it; `T-06-codes-check.mjs --show`,
  run locally, does (never commit that output).
- **STRICT RULE (the owner, 2026-10-01): never give the owner duties on family members' phones.**
  The owner handles family phones themselves. Don't list, track or assign per-phone steps
  anywhere. (The first real launch of the Android app is on the owner's **own** phone:
  RELEASE_TESTING.md.)
- **Still the owner's (MANUAL ACTION REQUIRED), only in their own accounts:** PC-008 on or after
  2026-10-08 00:35 IST: turn off GitHub Pages and delete the Firebase project (MOVE_FROM_FIREBASE
  step 8). Remind them then. Keep `data/move-report-*.txt` until then (T-06's codes check reads
  them).

**1. Open decisions:**
- **D-12:** the app into `web/`, after PC-008. No task waits on it.

**2. Pending checks:**
- **PC-011** (new, SF-018): right after the owner's push of T-06, the session checks the live
  site (steps and pass rule in STATE).
- **PC-010** (SF-018): the owner approves the privacy policy and its placeholders, a session
  edits both files and removes the Draft note, the owner's word to push, then `/privacy.html`
  200 and byte-identical, and the URL into Play Console.
- **PC-008** (2026-10-08 00:35 IST or later): GitHub Pages off and the Firebase project deleted.
- **PC-005** (T-08's push): steps 2–4 passed; T-09's PC-006 and PC-007 since covered steps 1 and
  5. Ask the owner once, then close it.
- PC-004 step 2 and PC-003 steps 3 and 4: ask only if the owner says they did them.
- PC-002 has lapsed: the stopgap rules were never published, and Firestore is read-only.
- PC-009 is done (its optional step 5 is the owner's own phone, if they like).

**MANUAL ACTION REQUIRED (owner), when ready** (the whole list:
[READINESS_REPORT.md](../google-play/READINESS_REPORT.md) and
[PRODUCTION_RELEASE_CHECKLIST.md](../google-play/PRODUCTION_RELEASE_CHECKLIST.md)):
- For PC-010: the policy's name, support email, effective date, jurisdiction and response time,
  and its LEGAL/OWNER items ([PRIVACY_POLICY.md](../google-play/PRIVACY_POLICY.md) section F).
  The ten declaration answers are **confirmed** ("All recommended", 06:20 IST) and applied.
- The PC-008 steps under 0.
- Create the upload key ([BUILD_RELEASE.md](../google-play/BUILD_RELEASE.md) section 3; never in
  the repo or its OneDrive folder), then build with sections 4–8. F-15 is now fixed, so any
  bundle from T-06 on keeps the Chrome OS manifest.
- The Play developer account and testers; the store listing (category, countries); filling in
  the forms with the confirmed answers ([PLAY_CONSOLE_DECLARATIONS.md](../google-play/PLAY_CONSOLE_DECLARATIONS.md)).
- `node_modules/` holds the old Firebase tools. It's git-ignored and unused, so the folder can be
  deleted.

**3. The queue** (STATE `tasks[]` order):

| Task | Stories | What it delivers | Points | Status |
|---|---|---|---|---|
| T-01 | SF-001 | Balance maths tested without the network | 2 | Done, deployed |
| T-02 | SF-002, 003, 004, 005, 006 | Play account guide, repo safety check, exact-paise money, safe group links | 9 | Done, deployed |
| T-03 | SF-007, 008, 009, 010, 011 | Firestore rules, offline start, honest sync status, the name, Railway hosting files | 9 | Done; live; rules never deployed (removed in T-09) |
| T-08 | SF-031, 032, 033, 034 | Railway backend: Node server, SQLite on a volume, the ledger API, live updates | 9 | Done; live as `a8bffb8` |
| T-09 | SF-035, 036, 037, 038 | The switch-over: the page on the API, offline outbox, copying the data, removing Firebase | 9 | Done; live as `db0580b` |
| T-04 | SF-022, 023, 029, 028, 015 | Edit expenses, settle-ups, recent groups, the new UI, the store listing | 11 | Done; live as `cc489a5` |
| T-05 | SF-012, 013, 014, 016 | The Android app, its signed release build, the build guide, the Play declarations | 11 | Done; pushed as `5f51b22`; nothing to deploy |
| **T-06** | SF-017, 018, 019, 020, 021 | **Privacy policy and page, testing guide, release checklist, final audit** | 8 | **Done** (accepted 2026-10-02 after the rework); not committed or pushed: needs the owner's word |
| T-07 | SF-030, 024, 025, 027 | **Stretch:** unequal splits, deleting a group, self-hosted fonts, automatic checks | 8 | Stretch: only if the owner promotes it |

Every planned task is done. The release now waits on T-06's push and on the owner's steps
(READINESS_REPORT.md "Ready / Not Ready"). T-07 starts only on the owner's word.

## Key facts for the next session

- **IDs:**
  - Tasks are `T-nn`; stories keep their `SF-nnn` IDs. T-01's receipts keep the `SF-001-*.md`
    names.
  - Review findings are numbered across tasks: F-1 to F-16, N-1 to N-23, and O-1 to O-4 so far.
    The next review continues from **F-17, N-24 and O-5**.
  - STATE decisions are `D-n` (D-21 is the newest, answered). Pending checks up to PC-011.
- **What T-06 made (done; uncommitted until the owner's push word):**
  - The server forgets IP addresses on a timer: `sweep()` in `createAddressLimiter`, run every
    `SWEEP_MS` (30 s) by `createApp`. The policy says 11 minutes; `tests/privacy.test.js` fails if
    the windows plus the sweep ever need longer. Change a window, and the policy changes too.
  - `docs/google-play/PRIVACY_POLICY.md`: section A is the policy; `privacy.html` repeats it word
    for word and `tests/privacy.test.js` compares them block by block (headings, paragraphs,
    list items). **Edit both together.** Section C: deleting a group on request with
    `railway ssh` and Node's REPL (tested locally, `evidence/T-06-deletion-check.mjs`; turns on
    `foreign_keys`, then a Railway **Restart** clears the server's cached answer).
  - `privacy.html`: no scripts, no web fonts, nothing from other sites (tested); a "Draft" note
    until PC-010. Linked from the welcome screen's small print and the group menu (`.policy-link`).
  - The message bar (`#notice`) is `popover="manual"`; `placeNotice()` moves it into the topmost
    open dialog (confirmation, else sheet, else `body`) and shows it, after each `showModal` and
    each dialog's `close`. A popover left in `body` is drawn on top but **inert** under a modal
    dialog (no taps; Chrome's accessibility tree ignores it): T-06's first browser run showed it.
  - `endPanel()` runs the open panel's close hook before `openExpense`/`openPay` set their state
    (N-14).
  - `railway.json` watches `/privacy.html`; a new wiring test checks every shipped file is
    watched (a push that changes only an unwatched file doesn't redeploy).
  - `RELEASE_TESTING.md` (dry-run in headless Edge: `evidence/T-06-browser-check.mjs`),
    `PRODUCTION_RELEASE_CHECKLIST.md` (`evidence/T-06-checklist-diff.mjs`: 37/37),
    `READINESS_REPORT.md`, PRODUCTION_AUDIT.md's "Final audit" (`evidence/T-06-audit.sh`,
    `evidence/T-06-codes-check.mjs`).
  - `android/app/src/main/res/raw/keep.xml` (F-15) and `twa-manifest.json text eol=lf` in
    `android/.gitattributes` (N-18): both verified in a clean-clone build
    (`evidence/T-06-build-transcripts.txt`). Lint now 14 warnings (was 15).
- **Facts for the policy and the declarations (checked 2026-10-02 IST):** Play's account-deletion
  rule covers only apps that let users create an account; new personal accounts need a closed
  test of 12 testers opted in for 14 continuous days; the pre-launch report runs on Android 9 and
  above; Railway's HTTP logs record `@srcIp`, `@clientUa`, `@path` (Pro: 30 days); `railway ssh`
  needs an SSH key registered with Railway (the CLI asks the first time).
- **Committed and pushed:** everything up to `5f51b22` (T-05, 2026-10-02). Commits and
  pushes each need the owner's word. This machine has no git identity: commits use the owner's
  GitHub no-reply identity (as in `cc489a5`), passed per command with `git -c user.name=… -c
  user.email=…`. Never a personal email.
- **Hashing:** `core.autocrlf=true` (Git's system config). Every file is LF on disk except
  `android/gradlew.bat` (CRLF). A clone checks text out as CRLF, apart from the
  `.gitattributes` rules; `npm test` passes on a CRLF clone (226/226 in T-06's clean clone).
- **Tests:**
  - `npm test` → 230 (no install, no network; Node 24 for `node:sqlite`).
  - `npm start` runs the server on http://localhost:8080 with its database in `data/`.
  - Browser checks: `evidence/T-06-browser-check.mjs` (RELEASE_TESTING.md's steps, the privacy
    page, F-14), `evidence/T-06-review-probe.mjs` (the IP retention; the bar under Escape and
    the confirmation; N-14 without `showModal`; each with a break run),
    `evidence/T-04-browser-check.mjs` (B0–B17) and `evidence/T-04-review-probe.mjs` (P1–P7). The
    page's logic is only exercised there.
  - Break checks: `evidence/T-06-break-checks.mjs` (20; edits files for a few seconds each);
    T-08's server ones, `evidence/T-08-break-checks.mjs` (20; B17 re-anchored in T-06's rework).
  - `evidence/T-06-rework-probe.mjs`: the server's real 30 s sweep (about 40 s to run).
  - `evidence/T-06-review2-probe.mjs <repo>` (the sweep against production limits, about 2 s) and
    `evidence/T-06-review2-breaks.mjs <repo>` (six F-16 breaks, about 30 s; X6 is caught only
    once N-23 is fixed).
  - Android: build from a clean clone outside OneDrive (BUILD_RELEASE.md), then
    `BUNDLETOOL=<jar> node docs/planning/evidence/T-05-android-checks.mjs <android dir>`.
- **Railway facts** (docs checked 2026-09-30 to 2026-10-02):
  - the edge sets `X-Real-IP`, and closes idle HTTP/1.1 connections after 60 s;
  - a response lasts at most 15 minutes if data flows, or 5 minutes without data;
  - volumes mount as root; a service with a volume has a few seconds of downtime per deploy;
  - HTTP logs record the client IP, user agent and path; kept 30 days on Pro;
  - the host has no AAAA record (IPv4 only).
  - The live service redeployed about 30 s after each push so far.
- **Owner decisions:**
  - Android: a TWA, package `com.splitfamilia.app`, named SplitFamilia; a personal Play
    account.
  - Railway in the owner's Pro workspace, at `https://splitfamilia.up.railway.app` (D-10).
  - D-13 to D-16 by default; D-17 (a) and D-18 (a) on the owner's word; D-19 the owner's icon;
    D-20 no emulator.
  - Old-style group codes stay guessable (D-4; N-3).
  - D-21: the family code in a test example replaced in the tree; history accepted.
- **Open follow-ups elsewhere:**
  - `#g=` invite links (SF-035, **OWNER CONFIRMATION REQUIRED**); they would also keep codes out
    of Railway's HTTP log paths (PRIVACY_POLICY.md section 5).
  - Deleted (and edited) entries stay until the group is deleted (the policy says so; SF-024
    would add deleting a group in the app).
  - SF-025 (self-hosted fonts) and SF-024 each change the policy: update PRIVACY_POLICY.md,
    `privacy.html` and the declarations together.
  - No themed (monochrome) launcher icon; optional.
- **This machine:**
  - Node 24.21.0, npm 11.19, Python 3.14 (no PIL), git 2.55; Edge and Chrome (headless Edge
    works for checks, and `--host-resolver-rules` can map a made-up host to 127.0.0.1);
  - Java 21 (Temurin 21.0.12.1, `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`, on
    PATH with `JAVA_HOME`); no Docker or `gh`.
  - **Android (installed in T-05 under D-8):** SDK in `%LOCALAPPDATA%\Android\Sdk`
    (cmdline-tools latest, platform-tools 37.0.1, platforms;android-36, build-tools 36.1.0 and
    35.0.0; `ANDROID_HOME` is **not** set: set it per command); bundletool 1.18.3 at
    `%LOCALAPPDATA%\Android\bundletool\bundletool-all-1.18.3.jar`; Gradle 8.11.1 in
    `%USERPROFILE%\.gradle`. Bubblewrap is not installed: `npx --yes @bubblewrap/cli@1.25.0`
    works (in the npm cache since the review). It reads `%USERPROFILE%\.bubblewrap\config.json`
    (`jdkPath`, `androidSdkPath`), which doesn't exist; the review set `USERPROFILE` and `HOME`
    to a scratch folder holding one, so nothing was written to the owner's profile. No emulator.
  - Headless Edge loads a 1Password extension (by policy). Its console lines show up in CDP
    captures; ignore them.
- **Quirks:**
  - For IST, use PowerShell:
    `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "India Standard Time")`.
  - **Gradle downloads time out over IPv6** (GitHub's release host): set
    `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true` for every `gradlew` run.
  - `sdkmanager.bat` (now the "Android CLI") splits `platforms;android-36` at the semicolon:
    write `platforms/android-36`.
  - **Build Android only outside the repo** (a scratchpad copy or clone): the repo is in
    OneDrive. VS Code's Gradle support may import `android/` by itself and create the ignored
    `android/.gradle/` and `android/build/`; delete them.
  - **The review session used PowerShell only** (the owner declined a Bash call at its start).
    The PowerShell safety check blocks `Remove-Item` when the command's text looks like a path
    (even `-replace '\\','/'`). Delete scratch folders with `[System.IO.Directory]::Delete(p, $true)`
    after clearing read-only attributes (`Get-ChildItem -Recurse -Force -File | % { $_.Attributes = 'Normal' }`;
    git's object files are read-only), clear variables with
    `[Environment]::SetEnvironmentVariable(name, $null)`, and use `.Replace([char]92, [char]47)`
    for slashes. Each PowerShell call is a new process: keep a throwaway password in a scratch
    file, never on screen.
  - Long Bash heredocs and `node -e` scripts with regexes get mangled (a `\r` once became a real
    carriage return in a test file). Write a script file to the scratchpad, then run it.
  - A plain `grep -r` walks `node_modules/` and times out. Use the Grep tool.
  - `git status --ignored` in a scratch clone prints "Filename too long" for Gradle's
    intermediates (the scratchpad path is long); harmless.
  - Windows refuses some of several hundred connections opened at once. Open them one by one in
    probes.
  - A test that leaves a `watchGroup()` running never lets its process exit. Stop every watch in
    `finally`.
  - Close headless Edge with CDP `Browser.close`; for a one-off screenshot,
    `msedge --headless=new --screenshot=… --user-data-dir=<scratch>` started with
    `Start-Process -Wait` works.
  - **CDP: don't pause new targets** (`waitForDebuggerOnStart: false`), and put a time limit on
    every reply (O-2). With two tabs, `Page.bringToFront` before a screenshot or the clipboard.
  - Background runs of headless Edge: stop leftovers by command line (the scratch profile),
    never all `msedge` processes; the owner's own Edge is running.
  - The break-check scripts edit source files for a few seconds each: never run them while a
    browser check or an Android build uses the same files.
  - PowerShell's execution policy blocks `.ps1` files; pass commands inline.
  - **Bash worked in T-06's session** (the owner allowed it). PowerShell is still needed for IST
    (`[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "India Standard Time")`):
    Git Bash has no time-zone data (`TZ=Asia/Kolkata date` prints UTC). A long Bash heredoc with
    many quotes failed again in T-06: write files with the file tool and join them.
  - To test lines meant for an interactive Node REPL, pipe them into `node -i` (plain `node`
    runs piped input as a script), and attach the child's `exit` listener before writing, or a
    fast `.exit` is missed and the script hangs.
  - A Java process started 2026-10-01 21:20 IST (VS Code's Java/Gradle support) keeps running;
    it is not a session's. Leave it.
  - **`git checkout` takes `.gitattributes` from the index, not the working tree.** To test a new
    eol rule in a scratch clone without committing, `git add` the `.gitattributes`, delete the
    file and `git checkout --` it (T-06 review, N-18).
  - A probe that runs several local servers in one Edge: CDP calls to a closed tab's service
    worker never answer (O-4); `setOffline` over every session then waits 20 s per stale one.
  - `T-06-review-probe.mjs` raises "Something went wrong…" on demand by throwing in a
    `setTimeout` (the page's global handler shows it once per load), and makes a browser without
    `showModal` with `Page.addScriptToEvaluateOnNewDocument`.

## Last session

- **2026-10-02, about 07:54–08:15 IST: T-06's second fresh review**, on the owner's "continue".
  **Accepted:** T-06 is done. No pending check was due.
  - Input verified: `fd61c458…` over 59 files, 38/38 hashes, unchanged after every break run.
  - `npm test` 230/230; T-06 break checks 20/20; T-08 break checks 20/20 and its review breaks as
    recorded.
  - This review's own probe:
    - a blocked guesser, a 300-change writer and a live stream on the real server: everything
      is held one ms before the window ends; both limiters are empty at its end, with the
      stream still held; all empty after the stream closes;
    - 10,000 addresses, half expired: exactly half are left;
    - the worst sweep pauses the server about 132 ms (acceptable).
  - Six new breaks: five caught. X6 isn't: N-23, a note on SF-017.
  - Also re-run: the real-interval probe (27.8 s); the browser dry run (only random IDs and the
    order of equal rows differ); the checklist; the codes check; the audit.
  - New PC-011. READINESS_REPORT.md's two T-06 status lines updated.
  - Nothing committed or pushed.
- **2026-10-02, about 06:57–07:20 IST: T-06's rework**, on the owner's "continue". F-16 (the
  address sweep, and the true bound in the policy and the declarations), N-22, N-20, N-21. T-06
  `review_required`. No pending check was due. `npm test` 230/230 (+4); T-06 break checks 20/20
  (+7); T-08 break checks 20/20 (B17 re-anchored); a probe of the real sweep interval; the browser
  dry run as before. No cache bump (v8 never deployed). Nothing committed or pushed.
- **2026-10-02, about 06:30–06:55 IST: T-06's fresh review**, on the owner's "continue".
  **Changes requested** (F-16, medium: the policy's "IP addresses kept at most 10 minutes" isn't
  what the server does; N-20 to N-22, O-4). Input verified (43/43, digest). `npm test` 226/226;
  break checks 13/13; checklist 37/37; audit and codes check as recorded; the browser dry run and
  the deletion steps re-run, the same as recorded; a new probe (`T-06-review-probe.mjs`) for the
  retention, Escape over a sheet, a message while the confirmation is open and N-14 without
  `showModal`, with break runs; the live site sets no cookie; a clean-clone Android build with a
  throwaway key (deleted): BUILD SUCCESSFUL, lint 0 errors, 17/17, F-15 and N-18 confirmed.
  Nothing committed or pushed.

- **2026-10-02, about 01:23–02:20 IST: T-06's implementation**, on the owner's "continue". All
  five stories done, `review_required`. No pending check was due. `npm test` 226/226 (+7 tests);
  break checks 13/13; the deletion steps tested locally; a browser dry run of the testing guide
  (one expected result fixed) and of the privacy page and F-14 (the first F-14 approach failed in
  the browser and was replaced); T-04's browser check re-run unchanged; a clean-clone Android
  build with a throwaway key (deleted): BUILD SUCCESSFUL, lint 0 errors, 17/17 checks, F-15 and
  N-18 verified; the final audit (no secret in 11 commits; D-21). Nothing committed or pushed.
  At 06:12 IST, on the owner's "go ahead with D-21 recommendation": the test example replaced
  (226/226; codes check: history only). About 06:20 IST: "All recommended" for the ten
  declaration answers, applied to the declarations, report, checklist and policy (226/226).
- **2026-10-02, about 01:20–01:25 IST: T-05's push**, on the owner's "ya commit and push":
  `5f51b22` (68 files, scanned, that tree 219/219); no redeploy; the live site unchanged.
- **2026-10-02, about 00:50–01:20 IST: T-05's fresh review**, on the owner's "continue".
  Accepted. Checked the input (29/29 hashes; the tree digest in Git Bash's form), ran `npm test`
  (219) and the 13 break checks, then built from a clean clone with two throwaway keys (deleted
  after): lint 0 errors; 7 keyless or broken signing runs all refused; the variables win over
  `keystore.properties`; jarsigner, bundletool and 17/17 Android checks pass. Regenerated the
  project with Bubblewrap 1.25.0 and diffed it (only the documented hand changes), inspected what
  R8's resource shrinker removed (F-15), checked the reviewer steps and the declarations' 22 code
  references, and re-checked five official pages. New: F-15, N-17, N-18, N-19, on the SF-019 and
  SF-021 cards. Nothing committed or pushed.
- **2026-10-01, about 19:15–21:40 IST: T-05's implementation**, then D-20 answered at 23:38 IST
  (no emulator).
- **2026-10-01, about 18:02–18:05 IST: T-04's push**, on the owner's "push": `cc489a5`, live
  about 30 s later; PC-009 passed.
- **2026-10-01, about 15:22–15:50 IST: T-04's fresh review** (accepted; F-14, N-14 to SF-018).
- **2026-10-01, about 10:22–11:20 and 15:15–15:25 IST: T-04's implementation** and D-19.
- **2026-10-01, about 00:20–10:15 IST: the switch-over (T-09)**, push B `db0580b`.
- **2026-09-30:** T-09's review and push A; T-08's reviews, push and D-18; the re-plan for
  Railway; T-03's review.
- **2026-09-29:** T-01 to T-03 pushed (`6f3b3fe`); Railway set up; the UI designed (`fa17597`).
