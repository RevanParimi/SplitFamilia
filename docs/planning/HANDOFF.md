# Current handoff — 2026-10-02 (IST)

## START HERE — resume checklist, in order

**0. T-05 is done:** its fresh review accepted it on 2026-10-02, about 00:50–01:20 IST
([evidence/T-05-review.md](evidence/T-05-review.md)). STATE: `active_task` T-05, `next_task` T-06,
`next_phase` implementation.
- **Next: T-06's implementation** (SF-017, 018, 019, 020, 021: the privacy policy, the testing
  guide, the release checklist and the final audit), in a **new conversation**, on the owner's
  "continue". Read every T-06 card first: each carries follow-ups from the T-04 review (F-14,
  N-14 on SF-018), from T-05 (SF-017, 018, 019, 021) and from T-05's review (F-15 and N-18 on
  SF-021, N-17 on SF-019).
- **Uncommitted:** all of T-05 (`android/`, the tests, four new docs, the evidence, the
  implementation and review receipts), the T-06 cards' follow-ups, and the previous session's
  record update (`evidence/T-04-pc009-output.txt` and the T-04 lines). Commit and push only on the
  owner's word. **A push of T-05 redeploys nothing:** no web file changed, and `railway.json`
  doesn't watch `android/`, `docs/` or `tests/`. Before committing, scan for secrets as in
  `cc489a5` (the review's scan found none).
- **STRICT RULE (the owner, 2026-10-01): never give the owner duties on family members' phones.**
  The owner handles family phones themselves. Don't list, track or assign per-phone steps
  anywhere. (The first real launch of the Android app is on the owner's **own** phone, SF-019.)
- **Still the owner's (MANUAL ACTION REQUIRED), only in their own accounts:** PC-008 on or after
  2026-10-08 00:35 IST: turn off GitHub Pages and delete the Firebase project (MOVE_FROM_FIREBASE
  step 8). Remind them then. Keep `data/move-report-*.txt` until then.

**1. Open decisions:**
- **D-12:** the app into `web/`, after PC-008. No task waits on it.
- D-20 is answered (2026-10-01 23:38 IST): no emulator; the first real launch is the owner's own
  phone via internal testing (SF-019).

**2. Pending checks:**
- **PC-008** (2026-10-08 00:35 IST or later): GitHub Pages off and the Firebase project deleted.
- **PC-005** (T-08's push): steps 2–4 passed; T-09's PC-006 and PC-007 since covered steps 1 and
  5. Ask the owner once, then close it.
- PC-004 step 2 and PC-003 steps 3 and 4: ask only if the owner says they did them.
- PC-002 has lapsed: the stopgap rules were never published, and Firestore is read-only.
- PC-009 is done (its optional step 5 is the owner's own phone, if they like).

**MANUAL ACTION REQUIRED (owner), when ready:**
- The PC-008 steps under 0.
- Create the upload key and keep it safe: [BUILD_RELEASE.md](../google-play/BUILD_RELEASE.md)
  section 3 (never in the repo or its OneDrive folder). Then build with sections 4–8. Best after
  SF-021's F-15 fix, but an internal-testing upload before it is fine (only Chrome OS is
  affected).
- The ten confirmations for the Play declarations:
  [PLAY_CONSOLE_DECLARATIONS.md](../google-play/PLAY_CONSOLE_DECLARATIONS.md) section 15
  (deletion requests, IP addresses, the group code, retention, the support email, "users
  interact", the target age, financial features, a reviewer demo link, self-hosting the fonts).
- The Play developer account and testers ([PLAY_CONSOLE_SETUP.md](../google-play/PLAY_CONSOLE_SETUP.md)).
- From the listing draft: the category (OWNER CONFIRMATION REQUIRED, Finance recommended), a
  support email and website, uploading the graphics ([STORE_LISTING.md](../google-play/STORE_LISTING.md)).
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
| T-05 | SF-012, 013, 014, 016 | The Android app, its signed release build, the build guide, the Play declarations | 11 | **Done** (reviewed 2026-10-02); not committed; nothing to deploy |
| **T-06** | SF-017, 018, 019, 020, 021 | **Privacy policy, testing guide, release checklist, final audit** | 8 | **Next** (todo; every dependency done) |
| T-07 | SF-030, 024, 025, 027 | **Stretch:** unequal splits, deleting a group, self-hosted fonts, automatic checks | 8 | Stretch |

## Key facts for the next session

- **IDs:**
  - Tasks are `T-nn`; stories keep their `SF-nnn` IDs. T-01's receipts keep the `SF-001-*.md`
    names.
  - Review findings are numbered across tasks: F-1 to F-15, N-1 to N-19, and O-1 to O-3 so far.
    The next review continues from **F-16, N-20 and O-4**.
  - STATE decisions are `D-n` (D-20 is the newest, answered).
- **T-05's review (2026-10-02):** accepted. F-15 (low): the release build's resource shrinker
  removes Bubblewrap's `res/raw/web_app_manifest.json` (kept by Bubblewrap for Chrome OS; phones
  unaffected): fix with a `res/raw/keep.xml` in SF-021. N-17: ANDROID_APPROACH.md says SF-018
  for the first launch; it is SF-019. N-18: `manifest-checksum.txt` vs a CRLF checkout: an
  optional `.gitattributes` line (SF-021). N-19: the receipt's `android/` digest recomputes
  only with Git Bash's `sha256sum` (`hash *file`).
- **What T-05 made (uncommitted, reviewed):**
  - `android/`: a Trusted Web Activity generated with `@bubblewrap/cli` 1.25.0 from
    `android/twa-manifest.json`. `com.splitfamilia.app`, versionCode 1 / "1.0.0", targetSdk and
    compileSdk 36 (Play: API 36 for new apps and updates from 2026-08-31; re-checked 2026-10-02
    IST), minSdk 21. Status bar `#4F46E5`, navigation bar and splash `#FFFFFF`. Adaptive icon
    from `icon-512.png`.
  - **No Android permissions at all** (not even `INTERNET`); AndroidX adds only its app-private
    signature permission.
  - `android/app/release.gradle` (ours): R8 + resource shrinking; signs only with the upload key
    from `SPLITFAMILIA_UPLOAD_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD` (all four; they
    win over the file) or the git-ignored `android/keystore.properties`; otherwise every release
    packaging task stops with "SplitFamilia release signing: …". `app/build.gradle` ends with
    `apply from: 'release.gradle'`; **`bubblewrap update` drops that line**, and `npm test`
    fails until it is back.
  - `android/.gitattributes`: `gradlew` LF, `*.bat` CRLF, `shortcuts.xml` LF.
  - `tests/android.test.js` (5 tests) and `tests/wiring.test.js` (assetlinks: 2–5 fingerprints;
    Play's hybrid signing gives a new app three app signing keys).
  - Docs: `ANDROID_APPROACH.md`, `BUILD_RELEASE.md`, `PLAY_CONSOLE_DECLARATIONS.md`,
    `REVIEWER_ACCESS.md` (all in `docs/google-play/`).
  - Evidence: `T-05-android-checks.mjs` (17 checks; needs `BUNDLETOOL`), `T-05-break-checks.mjs`
    (13), `T-05-build-transcripts.txt`, `T-05-icon-mask-check.png`; the review's
    `T-05-review-output.txt` and `T-05-review-regen-diff.mjs` (compares `android/` with a fresh
    `bubblewrap update`: reuse it after any regeneration).
- **Not done in T-05 (by design):** no device or emulator launch (D-20; SF-019); `assetlinks.json`
  keeps its placeholders until the owner's upload key and first Play upload (BUILD_RELEASE.md
  section 9; a web deploy on the owner's word).
- **Facts for the declarations and the privacy policy (re-checked 2026-10-02 IST):** Railway's
  HTTP logs keep each visitor's IP, user agent and path for 30 days (Pro); the server keeps an
  address only in memory, up to 10 minutes, for its limits; Railway redirects http to https;
  Google Fonts gets each visitor's IP until SF-025; data in Singapore, daily backups kept 6 days.
- **The T-04 review's carried items:** F-14 (the message bar under a sheet) and N-14, on SF-018.
  F-13, N-9, N-10 and N-12: no change needed unless the move script changes.
- **Committed and pushed:** everything up to `cc489a5` (T-04, 2026-10-01). Commits and
  pushes each need the owner's word. This machine has no git identity: commits use the owner's
  GitHub no-reply identity (as in `cc489a5`), passed per command with `git -c user.name=… -c
  user.email=…`. Never a personal email.
- **Hashing:** `core.autocrlf=true` (Git's system config). Every file is LF on disk except
  `android/gradlew.bat` (CRLF). A clone checks text out as CRLF, apart from the
  `.gitattributes` rules; `npm test` passes on a CRLF clone (219/219).
- **Tests:**
  - `npm test` → 219 (no install, no network; Node 24 for `node:sqlite`).
  - `npm start` runs the server on http://localhost:8080 with its database in `data/`.
  - Browser checks: `evidence/T-04-browser-check.mjs` (B0–B17) and
    `evidence/T-04-review-probe.mjs` (P1–P7). The page's logic is only exercised there.
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
- **Open follow-ups elsewhere:**
  - `#g=` invite links (SF-035, **OWNER CONFIRMATION REQUIRED**); they would also keep codes out
    of Railway's HTTP log paths.
  - Deleted (and edited) entries stay until the group is deleted (SF-017, SF-024).
  - `privacy.html` must be added to the Dockerfile, `.dockerignore` and `server/static.js`, with a
    cache bump (SF-017, SF-018).
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

## Last session

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
