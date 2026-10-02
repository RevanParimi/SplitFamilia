# T-06 implementation receipt — Privacy policy, testing guide, release checklist and final audit

- **Task:** T-06. Stories, in order: [SF-017](../stories/SF-017.md), [SF-018](../stories/SF-018.md),
  [SF-019](../stories/SF-019.md), [SF-020](../stories/SF-020.md), [SF-021](../stories/SF-021.md).
- **Phase:** implementation, 2026-10-02, about 01:23–02:20 IST, on the owner's "continue". The
  self-check here is **not** the fresh-session review.
- **Baseline:** `5f51b22` (T-05, pushed). Uncommitted at the start: only the T-05 push record in
  STATE.json and HANDOFF.md. Nothing committed or pushed in this phase.
- **Review input:** 43 changed or new files (the record files STATE.json, HANDOFF.md and this
  receipt excluded), SHA-256 of each as on disk (LF) in the table under "Changes"; the digest of
  `sha256sum` over the sorted list is
  `7c0a2d6fe923cbb1085bede125d4869a31a086c2a3b377c761925a306ee56558`. Recompute in Git Bash:
  `git status --porcelain=v1 -uall | sed 's/^...//' | grep -vE '^docs/planning/(STATE.json|HANDOFF.md|evidence/T-06-implementation.md)$' | sort | while IFS= read -r f; do sha256sum "$f"; done | sha256sum`.

## What it does, in one example per story

- **SF-017:** the policy says, for example, "Railway keeps these logs for 30 days" and "The
  server keeps the old entry, marked as deleted, until the whole group is deleted": each sentence
  traced to code or a cited page (section E). Play's account-deletion rule doesn't apply: no
  accounts (section B, quoting Play's page). A deletion request is handled by tested `railway
  ssh` steps: before `{ groups: 1, people: 4, expenses: 5, splits: 9 }`, after all zeros, the API
  then 404 for that code.
- **SF-018:** on the welcome screen, under "Anyone with a group's invite link can open it on any
  phone.", a **Privacy policy** link opens `privacy.html` (17 sections, a "Draft" note), and works
  offline after the first visit. A refused change raised while "Add expense" is open now shows
  its red bar **above** the sheet, and its × works.
- **SF-019:** the testing guide's M1: "Dinner, ₹300, paid by Asha, split equally" → "Ben owes
  Asha ₹100.00", "Chitra owes Asha ₹100.00"; its M10 (Dinner's payer changed to Ben after two
  payments) → "Asha owes Ben ₹340.00", "Chitra owes Ben ₹100.00". Both were clicked through in
  headless Edge and matched.
- **SF-020:** "[ ] Privacy policy publicly accessible" is in the checklist word for word under
  "Play Store", with who does it and where; "[x] Permissions reviewed" is pre-ticked with its
  evidence. 37/37 of the brief's boxes found.
- **SF-021:** the audit found no secret in the tree or 11 commits, but one real family group code
  used as a test example since `6f3b3fe`, escalated as D-21. The Android bundle was rebuilt from
  a clean clone (BUILD SUCCESSFUL, 17/17 checks) with the T-05 review's F-15 fixed.

## Per-story status

| Story | Done? | Acceptance criteria met | Notes |
|---|---|---|---|
| SF-017 | Yes | Every topic in the card, from verified behaviour; the five placeholders (the card's four plus `<RESPONSE_TIME>`); LEGAL/OWNER and OWNER markers, no named law; Play's account-deletion page quoted (checked 2026-10-02 IST) with the conclusion; the manual deletion steps, tested locally; the cross-check table (no mismatch) and the per-section evidence table | The card's "Firestore" and "Firebase console" items were replaced by its own Railway notes (2026-09-30). `railway ssh` itself wasn't run (no access to the owner's account) |
| SF-018 | Yes, pending the owner's gate | `privacy.html` matches the policy word for word (a test); app colours and logo, 360 px without sideways scroll; linked from the welcome screen and the group menu; in the worker's `SHELL` (opens offline), cache v8; the Draft note; the URL recorded in STORE_LISTING.md and the declarations; PC-010 added; F-14 fixed and N-14 done | Not deployed: `production_verification` is `pending_deployment` until the owner approves the text and a push (PC-010) |
| SF-019 | Yes | Every item of brief stage 7, with "Not in this app" and a reason where absent; steps and hand-worked results; offline, slow network, backend errors, restart, deep links, Android versions, screen sizes, the Play-signed build; Internal → Closed → Production with the 12-testers-for-14-days rule (VERIFY IN PLAY CONSOLE, page checked 2026-10-02); T-05's first-launch checks (A1–A6); N-17 fixed | `npm run test:rules` no longer exists (SF-038); `npm test` ran. The dry run caught one wrong expected result (M14), now fixed |
| SF-020 | Yes | Every brief box word for word under the same headings (diff: 37/37, in order); this app's checks, with the card's Railway replacements; who and where for each; 8 repo boxes pre-ticked with evidence, nothing account-dependent ticked | The Firebase API key item no longer applies (the card's 2026-09-30 note) |
| SF-021 | Yes | The audit commands and results in PRODUCTION_AUDIT.md, every hit classified; the real-data hit escalated (D-21), not rewritten; `assetlinks.json` placeholders flagged; `npm test`, lint and `bundleRelease` re-run this session; READINESS_REPORT.md with the seven sections; F-15 and N-18 done | No upload AAB: it needs the owner's key (the report says so, with the next command). `npm run test:rules` no longer exists |

## Changes

| File | SHA-256 (first 16) | What changed |
|---|---|---|
| `docs/google-play/PRIVACY_POLICY.md` | `96fed8ba587f6794` | New (SF-017): the policy (A), the account-deletion answer (B), deletion steps (C), the cross-check (D), evidence (E), notes before publishing (F) |
| `privacy.html` | `3862b5a8cf869f93` | New (SF-018): the policy page, app colours, no scripts or other sites, the Draft note |
| `index.html` | `a4d32b1fbdad7d1f` | Privacy links (welcome small print, group menu); the message bar as a popover placed in the topmost open dialog (F-14); `endPanel()` (N-14); imports `?v=8` |
| `service-worker.js` | `5b6f4b029822d69a` | `splitsheet-v8`, `?v=8`, `./privacy.html` in `SHELL` |
| `server/static.js` | `563f2f77c6e448c9` | Serves `/privacy.html` |
| `Dockerfile` | `89b8aabc2cf72605` | Copies `privacy.html` |
| `.dockerignore` | `cdf05c67ed66f7d9` | Lets `privacy.html` in |
| `railway.json` | `956a65ac55739ada` | Watches `/privacy.html` (otherwise a push changing only it wouldn't redeploy) |
| `tests/privacy.test.js` | `e76d3ef39c15386d` | New: page = policy text, nothing from other sites, linked in the app, served/cached/shipped (5 tests) |
| `tests/wiring.test.js` | `2384b4bd2615370c` | New test: every shipped file is covered by a watch pattern, and docs/tests aren't |
| `tests/service-worker.test.js` | `01048610a73bae04` | `privacy.html` in the shell; new test: the policy opens offline; "other pages" uses `help.html` |
| `tests/server-static.test.js` | `437a717b0a54e71b` | `/privacy.html` in the expected files |
| `tests/group-code.test.js` | `0f70c44f56151c39` | D-21 (answered about 06:12 IST): a real family code used as an example replaced by the made-up `trek-1999` (two occurrences; done by hash, never printed) |
| `android/app/src/main/res/raw/keep.xml` | `62388bb49085c3d2` | New (F-15): keeps `raw/web_app_manifest` |
| `android/.gitattributes` | `4bae165684da3886` | `twa-manifest.json text eol=lf` (N-18) |
| `docs/google-play/RELEASE_TESTING.md` | `6ec59f9f817a62a0` | New (SF-019) |
| `docs/google-play/PRODUCTION_RELEASE_CHECKLIST.md` | `d869cff0fa25c3f8` | New (SF-020) |
| `docs/google-play/READINESS_REPORT.md` | `edbbb6a21359adc0` | New (SF-021) |
| `docs/google-play/PRODUCTION_AUDIT.md` | `364e5825454cfc35` | "Final audit (SF-021)": commands, every hit classified, stage-1 items now |
| `docs/google-play/PLAY_CONSOLE_DECLARATIONS.md` | `ce82285aac77d3d0` | The policy URL, the server's timestamps in section 0, the deletion answer's link to the tested steps, two moved line numbers |
| `docs/google-play/STORE_LISTING.md` | `99b8a7e7165cd1bd` | `<PRIVACY_POLICY_URL>` replaced by the URL |
| `docs/google-play/ANDROID_APPROACH.md` | `3c778e2744910db9` | N-17 (SF-019, not SF-018); `keep.xml` and the `.gitattributes` lines in the file table |
| `docs/planning/REVIEW.md` | `022254ee9e7f3eee` | Release invariants: watch patterns, the policy as the truth, messages over sheets, no private data in git; least permission updated |
| `README.md` | `4d7de328d23adbd7` | The repo map: `privacy.html`, the new docs, the test list |
| `CLAUDE.md` | `9dd9e5cb131fbbcc` | `privacy.html`, the watch-pattern rule, `tests/privacy.test.js` |
| `docs/planning/evidence/T-06-*` (18 files) | see the digest | The checks and their outputs (Tests below), four screenshots |

## Decisions for the reviewer

- **D1 (SF-017/018): one text, two files, a test between them.** The policy text is
  PRIVACY_POLICY.md section A; `privacy.html` repeats it as HTML, and `tests/privacy.test.js`
  compares them block by block (headings, paragraphs, list items). There's no build step to
  generate one from the other. Example: "30 days" changed to "60 days" in the page only → the
  test fails (break check K1). Cost: an edit is made twice.
- **D2 (SF-017): Firebase isn't named in the public policy.** After PC-008 (from 2026-10-08) no
  Firebase copy exists, and shipped files must not mention Firebase (`npm test`). Section F tells
  the owner to publish after PC-008, or have a sentence added if earlier.
- **D3 (SF-017): deletion by `railway ssh` and Node's REPL.** No admin endpoint was added (that
  is SF-024's in-app delete). The lines turn on `foreign_keys`, so deleting the `groups` row
  cascades to everything, deleted rows included; then a **Restart** clears the server's in-memory
  answer for that group and its live streams. Tested on a local database while the server ran
  (`T-06-deletion-check.mjs`): before `{ groups: 1, people: 4, expenses: 5, splits: 9 }`, delete
  `{ changes: 1 }`, after all zeros, API 404, the other group unchanged.
- **D4 (SF-017): honest extras.** The policy also says the owner can read the database, that a
  phone's waiting change is still sent after "Remove from this device" (as P5 of the T-04 review
  showed), and that a phone still holding a deleted group could recreate an empty one by changing
  its currency (section C step 6; `PUT /api/group` creates a group).
- **D5 (SF-018): the policy page loads no web fonts.** It uses the app's font stack, which falls
  back to the system font, so reading the policy sends nothing to Google. Cost: headings in the
  system font, not Plus Jakarta Sans.
- **D6 (SF-018): F-14 by a popover inside the open dialog.** The first try (a popover in `body`)
  was drawn on top but stayed inert under the modal sheet: in the first browser run its centre hit
  the sheet, Chrome's accessibility tree ignored it, and a tap on × did nothing. Now `placeNotice()`
  moves the bar into the topmost open dialog (confirmation, then sheet, else `body`) and shows it
  as a popover, after each `showModal` and each dialog's `close`. Browsers without popovers keep
  the old behaviour. Cost: moving an element with `role="alert"` may make a screen reader read it
  again when a sheet opens.
- **D7 (SF-018): a watch-pattern test for every shipped file.** `railway.json` didn't cover
  `privacy.html`, so a push changing only the page would not have redeployed. The new wiring test
  checks every file the Dockerfile copies against the patterns (and that docs and tests stay
  out).
- **D8 (SF-019): rounding results say "or" where they depend on IDs.** The extra paisa goes to
  the person whose internal ID sorts first (`splitShares`), so the card's "₹66.67 as ₹33.34 +
  ₹33.33" is one of two outcomes; M6 gives both, and M5 uses a split without the payer so the
  total is always ₹100.00. In the dry run Chitra got the paisa both times.
- **D9 (SF-019): Android 5–8 are an accepted gap unless the owner wants an emulator.** Play's
  pre-launch report covers Android 9 and above; the guide says so and leaves the choice (D-20).
- **D10 (SF-020): owner-account items are never pre-ticked,** even when a session recorded them
  done (for example `IMPORT_TOKEN` removed on 2026-10-01): the owner re-checks and ticks.
- **D11 (SF-021): a throwaway-signed bundle proves the build; no upload bundle.** The owner's key
  doesn't exist; the report gives the blocker and the next command.
- **D12 (SF-021): the real group code is escalated, not changed.** CLAUDE.md and the card say
  real secrets go to the owner; the test file and history are left as they are. The codes check
  prints no code, length or hash, only the folder (`tests/`); `--show`, run locally, names the
  file. The owner hears the exact place in chat. **Answered (06:12 IST):** the owner took the
  recommendation; the example is now made up (codes check: history only).

## Tests

| Check | Command | Result |
|---|---|---|
| Unit, server, client, worker and wiring tests | `npm test` | **226/226** (was 219: +5 privacy, +1 worker, +1 wiring), in the tree and in the clean clone |
| Break checks for the new tests | `node docs/planning/evidence/T-06-break-checks.mjs` | **13/13 caught**, every file restored byte for byte (output: `T-06-break-checks-output.txt`). The first run missed K7; the test was tightened |
| The deletion steps | `node docs/planning/evidence/T-06-deletion-check.mjs . <scratch>` | As in D3 (`T-06-deletion-check-output.json`) |
| Browser dry run of RELEASE_TESTING.md, the privacy page, F-14 | `node docs/planning/evidence/T-06-browser-check.mjs . <scratch> <shots>` (headless Edge, 360 px, local server) | Every expected text and balance matched (I1–M13, P1–P2, L2–L3, S2, S5, O1–O5, R1, E1–E3); M14 corrected in the guide after the first run. F-14: bar on top inside the sheet and the confirmation, not ignored by accessibility, × closes it with the sheet still open; back in `body` when the sheet closes. Privacy page: 17 sections, Draft note, no fonts or scripts, no sideways scroll at 360 or 800 px, opens offline. No page errors, no dialogs (`T-06-browser-check-output.json`, screenshots in `T-06-screens/`) |
| T-04's browser check re-run (regressions) | `node docs/planning/evidence/T-04-browser-check.mjs . <scratch>` | Identical to its recorded output except today's date and `splitsheet-v8` (`T-06-rerun-t04-browser-check-output.json`) |
| Release checklist against the brief | `node docs/planning/evidence/T-06-checklist-diff.mjs .` | 37/37, in order; 8 ticked; 8 added (`T-06-checklist-diff-output.txt`) |
| The final audit | `bash docs/planning/evidence/T-06-audit.sh` | As classified in PRODUCTION_AUDIT.md "Final audit" (`T-06-audit-output.txt`) |
| Real group codes in git | `node docs/planning/evidence/T-06-codes-check.mjs` | 1 of 2 codes found in `tests/` (tree and history): D-21 (`T-06-codes-check-output.txt`) |
| Android: clean, lint, bundle | clean clone outside OneDrive, `./gradlew --no-daemon clean lintRelease bundleRelease` with a throwaway key | BUILD SUCCESSFUL in 42 s; lint 0 errors, 14 warnings |
| Android: the bundle | `jarsigner -verify`, `bundletool validate`, `dump manifest`, `T-05-android-checks.mjs` | verified; valid; 1 / 1.0.0, min 21, target 36, one private permission, no debuggable/testOnly/cleartext; **17/17**. F-15: `raw/web_app_manifest` reachable and in the bundle. N-18: LF checkout, checksum matches (this session's transcript has no N-18 section; the review verified it: [T-06-review-output.txt](T-06-review-output.txt) section 10, N-21) |

Not exercised: the app on a phone or emulator (D-20; RELEASE_TESTING.md is the owner's first
launch); the Docker image (no Docker here; the wiring tests check what it ships); `railway ssh`
and Railway's Restart (no access to the owner's account); the privacy page on Railway (not
deployed); a screen reader (the accessibility tree was checked instead).

## Documentation

New: PRIVACY_POLICY.md, RELEASE_TESTING.md, PRODUCTION_RELEASE_CHECKLIST.md,
READINESS_REPORT.md. Updated: PRODUCTION_AUDIT.md, PLAY_CONSOLE_DECLARATIONS.md,
STORE_LISTING.md, ANDROID_APPROACH.md, REVIEW.md, README.md, CLAUDE.md; STATE.json and
HANDOFF.md at the end of the phase.

## Open limitations and follow-ups

- **D-21:** answered; the tree is clean, history keeps the old code (accepted).
- **The ten declaration answers:** confirmed by the owner ("All recommended", 2026-10-02 about 06:20
  IST). Applied to the declarations, the readiness report, the checklist, and the policy (sections
  10 and 14, in both files; `npm test` 226/226). Still needed from the owner for PC-010: the name,
  support email, effective date, jurisdiction, response time and the LEGAL/OWNER items.
- **PC-010 (owner, then a session and a push):** approve the policy, fill in its placeholders,
  remove the Draft note, deploy, check the URL; then paste it into Play Console.
- **`assetlinks.json`** keeps its placeholders until the owner's fingerprints (BUILD_RELEASE.md
  section 9): a release blocker.
- **The upload bundle** needs the owner's key.
- The policy's facts depend on Railway's Pro plan (30-day logs) and Google Fonts; SF-025 (fonts),
  SF-024 (delete a group) and `#g=` links (SF-035) each change a section.
- Android 5–8 untested (D9).
- The T-04 review's carried items F-13, N-9, N-10, N-12 still need no change.

## Rework (2026-10-02, about 06:57–07:20 IST)

On the owner's "continue", after [the review](T-06-review.md) asked for changes. It fixes F-16,
N-20, N-21 and N-22 from the SF-017, SF-020 and SF-021 cards. The self-check here is **not** the
fresh-session review.

- **Baseline:** still `5f51b22` (`main` = `origin/main`), with T-06's uncommitted changes and the
  review's files. Nothing committed or pushed in the rework.
- **Review input now:** the digest command at the top of this receipt (it excludes STATE.json,
  HANDOFF.md and this receipt) gives
  `fd61c458ab25db2db547f399e4359eb507aba2f8dfc145607554d349d13fdddb` over 59 files.

### What it does, in one example

A phone makes one request with a group code that doesn't exist and never comes back. Before: its
IP address stayed in the server's memory until a restart (the review's probe: still there after a
week). Now: the server's sweep forgets it 10 to 10.5 minutes later, with no further request; the
rework probe measured 27.9 s of real time after the 10-minute window passed, under the 30 s sweep.
The policy says "at most 11 minutes after the last request", and a test fails if the code ever
needs longer.

### F-16 (medium): the server keeps the policy's promise about IP addresses

- **Code.** `createAddressLimiter` (`server/api.js`) has a `sweep()` that forgets every address
  with no event left in the window (the same `recent()` check the other calls make). `createApp`
  (`server/server.js`) runs it for both limiters every `SWEEP_MS` (30 s, exported from
  `server/api.js`), with `unref()`, and `close()` clears the timer. So the limiters keep an address
  at most a window (10 minutes) plus one sweep (30 s) after its last event. The live hub is
  unchanged: it counts an address while its stream is open and drops it on `close` (tested since
  T-08, `tests/server-live.test.js`).
- **Policy (both files, word for word; the test compares them).** Section 5: "It keeps the address
  while a live connection from the app is open (the app keeps one open while a group is open, for
  live updates), and for at most 11 minutes after the last request from that address. It never
  stores or logs the address." Section 10: "The server keeps an IP address in memory only while a
  live connection from the app is open, and for at most 11 minutes after the last request from
  it." 11 minutes, not 10.5, leaves room for a late timer. Section D's cross-check row and section
  E's rows 5 and 10 point at the code.
- **Declarations.** The "Where the data goes" IP row and "IP addresses" say the same bound; the code
  table's `server/api.js` line links moved (two header lines and the sweep were added) and now
  include the sweep, its timer and the live hub.
- **Why a live connection is named.** A page with a group open holds one event stream, and the hub
  needs the address for the per-address limit of 10 streams (D-17). On Railway a stream ends
  within 15 minutes at most (the edge's limit), and the page opens a new one.
- **Tests (+4, `npm test` 230/230):**
  - `tests/server-api.test.js` "F-16: a sweep forgets an address…": both limiters, fake clock;
    one millisecond before the window ends both addresses stay, at the window's end both go; an
    address that returns starts afresh.
  - "F-16: the server sweeps both limiters on a timer…": the real server with `sweepMs: 20`; an
    unknown code and a new group, the clock moved 10 minutes, no further request: both limiters
    empty; after `close()` the sweep is never called again.
  - "F-16: the sweep timer doesn't keep the process running": a child Node process creates an
    app and never closes it; it exits by itself (status 0, within 15 s).
  - `tests/privacy.test.js` "the policy's time for IP addresses…": reads "for at most N minutes
    after the last request" from both policy sections and checks the longest window plus
    `SWEEP_MS` fits in N; the live-connection clause is there; the declarations give the same N
    twice.
- **Break checks** (`T-06-break-checks.mjs`, K14–K20 added; output `T-06-break-checks-output.txt`):
  **20/20 caught**, every file restored. K14 the sweep forgets nothing; K15 the timer never sweeps;
  K16 `close()` leaves the timer; K17 no `unref()`; K18 the policy says 10 minutes again in both
  files; K19 the change window grows to 15 minutes; K20 the declarations give another time.
- **T-08's checks re-run (the limiter is T-08's):** `T-08-break-checks.mjs` **20/20 caught**. Its
  B17 text appears twice since T-04 (`cc489a5` gave the edit route the same cap line), so the
  script stopped at B17 with "found 2" before reaching B17–B20. B17 is now anchored on the line
  before it in the add route (a comment in the script says so). `T-08-review-breaks.mjs`: R1, R2,
  R4–R8 caught, R3 skipped as in T-09's re-run (its text is gone from `server/api.js`; T-09's receipt, C21). Output:
  `T-06-rework-t08-breaks-output.txt`.
- **Probe on the real interval** (`T-06-rework-probe.mjs`, output `T-06-rework-probe-output.json`,
  pass): the server with the default `SWEEP_MS`, addresses as `X-Real-IP` (RFC 5737). At the start
  the guess limiter holds 2, the change limiter 1, the hub 1; at 9 min 59 s (server clock), after
  a real sweep, the same; once the window passes, both limiters are empty 27.9 s later with no
  request; the stream's address stays while it is open, and goes when it closes.

### N-22, N-20, N-21

- **N-22:** section 4 now says a waiting change "is still sent the next time a group is open in
  the app while online" (both files). Checked against the code: the outbox runs only inside
  `startApp`, and `sendAll` loads and sends every group's waiting changes, so any open group sends
  a removed group's change. Section E row 4 says so.
- **N-20:** PRODUCTION_RELEASE_CHECKLIST.md's ticked "No production secrets committed" now says one
  of the family's real group codes, once a test example, stays in public history since `6f3b3fe`,
  the tree has a made-up one, and the owner accepted that (D-21). It names no code. The checklist
  diff still gives 37/37 and nothing missing.
- **N-21:** the Tests table's Android bundle row now points N-18 at
  [T-06-review-output.txt](T-06-review-output.txt) section 10 (it has an "N-18" part there).

### Rework changes

| File | SHA-256 (first 16) | What changed |
|---|---|---|
| `server/api.js` | `5adac8b97e493576` | `SWEEP_MS`; the limiter's `sweep()`; a header line on where addresses are kept |
| `server/server.js` | `a730ce2fe7aaff83` | The sweep timer (`unref`, `sweepMs` for tests), cleared in `close()` |
| `tests/server-api.test.js` | `380af2907b81cfb5` | 3 tests (F-16) |
| `tests/privacy.test.js` | `5103d98550cc38b1` | 1 test: the policy's minutes against the code and the declarations |
| `privacy.html` | `7ef71de253c6bc74` | Sections 4, 5 and 10 (as the policy) |
| `docs/google-play/PRIVACY_POLICY.md` | `07f27699dcc0134b` | Sections 4, 5, 10; D's IP row; E rows 4, 5, 10 |
| `docs/google-play/PLAY_CONSOLE_DECLARATIONS.md` | `0bfd00b8cb2ead9e` | The IP row, "IP addresses", the code table's moved lines |
| `docs/google-play/PRODUCTION_RELEASE_CHECKLIST.md` | `b6361743c34b197b` | N-20 |
| `docs/google-play/READINESS_REPORT.md` | `054b0e37b79a3d7a` | Status, 230 tests, the rework's change and break checks |
| `docs/google-play/PRODUCTION_AUDIT.md` | `d6f10928a6f5653c` | 230/230 after the rework |
| `docs/google-play/RELEASE_TESTING.md` | `7fc5c10016999c6f` | 230 tests |
| `docs/planning/REVIEW.md` | `02b990cd2269fb19` | Invariant: addresses in memory only, the bound, the test |
| `CLAUDE.md` | `5889704753f9aba8` | The sweep and what `tests/privacy.test.js` checks |
| `docs/planning/stories/SF-017.md`, `SF-020.md`, `SF-021.md` | `c7b3743c187717bf`, `d9f61e2b63ed3b10`, `90f282c19bd63f3d` | The follow-ups marked done in the rework; SF-017's T-05 note corrected |
| `docs/planning/evidence/T-06-break-checks.mjs` | `696394ecdbdfa17e` | K14–K20 |
| `docs/planning/evidence/T-06-break-checks-output.txt` | `d77fcc64c8d72834` | 20/20 |
| `docs/planning/evidence/T-08-break-checks.mjs` | `1191842211dbf661` | B17 anchored (see above) |
| `docs/planning/evidence/T-06-rework-probe.mjs`, `-output.json` | `86c21a8a87f683c2`, `e31646e697eb7222` | New: the probe above |
| `docs/planning/evidence/T-06-rework-t08-breaks-output.txt` | `43e852f81868031f` | New: T-08's break checks re-run |
| `docs/planning/evidence/T-06-rework-browser-check-output.json` | `24f3590bd4f02b46` | New: the browser dry run re-run |
| `docs/planning/evidence/T-06-implementation.md` | (this file) | N-21; this section |

### Rework tests

| Check | Command | Result |
|---|---|---|
| All tests | `npm test` (Node 24.21.0) | **230/230** (226 + 4) |
| T-06 break checks | `node docs/planning/evidence/T-06-break-checks.mjs` | **20/20 caught**; every file's SHA-256 the same after the run |
| T-08 break checks | `node docs/planning/evidence/T-08-break-checks.mjs`; `node docs/planning/evidence/T-08-review-breaks.mjs` | **20/20**; R1, R2, R4–R8 caught, R3 skipped (as in T-09) |
| The real sweep interval | `node docs/planning/evidence/T-06-rework-probe.mjs` | pass; forgotten 27.9 s after the window |
| Browser dry run (the policy text changed) | `node docs/planning/evidence/T-06-browser-check.mjs . <scratch> <shots>` | The same as the review's run apart from random IDs and the order of equal rows (22 such differences; the extra paisa still goes to the first person by ID). No page errors or dialogs. The stored privacy screenshots show sections 1–2 and 14–17, which didn't change, so `T-06-screens/` is unchanged |
| Release checklist | `node docs/planning/evidence/T-06-checklist-diff.mjs .` | 37/37, nothing missing (unchanged) |

Not re-run: the Android build (no file under `android/` changed in the rework), the audit and the
codes check (no secret, key or code added; the N-20 line names no code), the deletion steps (the
database and its steps didn't change).

### Decisions in the rework

- **R1. 30-second sweeps, "11 minutes" in the policy.** The window stays 10 minutes (the guessing
  limit needs it). A sweep every 30 s keeps an address at most 10.5 minutes; the policy rounds up
  to 11, so a busy event loop can't break the promise. Example: an unknown code at 10:00:00 is
  forgotten between 10:10:00 and 10:10:30. The sweep walks at most 10,000 addresses every 30 s.
- **R2. The live connection is stated, not shortened.** The per-address stream limit (D-17) needs
  the address while the stream is open. Example: a page left open on a group keeps its address in
  the hub; closing it drops the address at once.
- **R3. No cache bump.** `privacy.html` changed, but `main` (`5f51b22`) still serves
  `splitsheet-v7` and has no `privacy.html`: no phone has a v8 copy, so v8 stays the first deploy
  of these files.
- **R4. T-08's B17 fixed in its script**, not copied, so the next review can run it as it is.

### Open after the rework

- The same as "Open limitations and follow-ups" above. The rework adds none.
- Nothing from T-06 is committed or pushed. A push is a production deploy (the web files above,
  plus `server/api.js` and `server/server.js` now), on the owner's word, after a fresh review
  accepts the rework.
