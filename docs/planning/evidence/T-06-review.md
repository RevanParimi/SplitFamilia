# T-06 review receipt — Privacy policy, testing guide, release checklist and final audit

- **Task:** T-06. Stories: [SF-017](../stories/SF-017.md), [SF-018](../stories/SF-018.md),
  [SF-019](../stories/SF-019.md), [SF-020](../stories/SF-020.md), [SF-021](../stories/SF-021.md).
  Implementation receipt: [T-06-implementation.md](T-06-implementation.md).
- **Review context:** a fresh-session review, 2026-10-02, about 06:30–06:55 IST, on the owner's
  "continue". Outputs: [T-06-review-output.txt](T-06-review-output.txt),
  [T-06-review-probe-output.json](T-06-review-probe-output.json) (from
  [T-06-review-probe.mjs](T-06-review-probe.mjs)) and
  [T-06-review-browser-check-output.json](T-06-review-browser-check-output.json).
- **Reviewed input:** the 43 files of the receipt: digest
  `7c0a2d6fe923cbb1085bede125d4869a31a086c2a3b377c761925a306ee56558` and every per-file hash
  equal to the receipt's table. **Verified: yes**, before and after the break checks.
- **Verdict:** `changes_requested`. One medium finding (F-16) leaves an SF-017 acceptance
  criterion unmet: the policy promises that the server forgets IP addresses within 10 minutes, and
  the code doesn't. Everything else passes, including the F-14 and N-14 fixes in the browser and
  F-15 and N-18 in a fresh Android build.
- **Second review, after the rework (2026-10-02, about 07:54–08:15 IST):** `accepted`. See
  [Second review: the rework](#second-review-the-rework) below.

## Contract checked and adversarial examples

| # | Input | Expected (by the contract, worked out by hand) | Observed |
|---|---|---|---|
| 1 | The policy's "SplitFamilia's server uses the IP address in memory only, for at most 10 minutes" (section 5) and "The server forgets IP addresses within 10 minutes" (section 10). The real limiters, with a fake clock: one request from `192.0.2.1`, which never comes back; another address 11 minutes later; another a week later | 11 minutes on, only the newest address is held (1); a week on, 1 | **2, then 3**, for both the guess and the write limiter. The first address goes only when it is seen again (`afterFirstAddressSeenAgain`: 2), when 10,000 newer addresses push it out, or on a restart. The live hub holds an open stream's address with no time limit (`addressHeldWhileStreamOpen: true`), and Railway lets the page reconnect for as long as it is open. No timer in `server/` sweeps the limiters (probe Part A). **F-16** |
| 2 | B1: "Add expense" open; an unexpected error raises "Something went wrong…"; then Escape | The bar is inside the sheet, on top, not ignored by accessibility; Escape closes the sheet and the bar goes back to the page, still on top; × dismisses it | As expected (`inside: sheet`, `noticeOnTop: true`, `ignored: false`; after Escape `inside: BODY`, on top; after ×: hidden, popover closed) |
| 3 | B2: offline, Lunch edited to ₹120; another phone deletes Lunch; on the phone, Dinner → Delete (the confirmation open); back online | The refusal "Couldn't save the expense “Lunch”…" appears **inside the confirmation**, on top and usable; its × hides it and the confirmation stays open; Cancel leaves the Dinner sheet open with no bar; closing it leaves no bar; the server keeps Dinner only | As expected (`inside: confirm`, on top, `ignored: false`; after ×: `confirmOpen: true`, hidden; after Cancel: in the sheet, hidden; at the end: in `BODY`, hidden; server `Dinner 30000`) |
| 4 | B1–B2 on a copy of the app with the bar never moved into the dialog (T-06's first approach) | The probe must tell the difference | It does: the bar is drawn but **not on top** at its centre (the sheet's `split-text`, then the confirmation), ignored by accessibility, and a tap on its × **cancels the confirmation** instead (`confirmOpen: false`, bar still shown) |
| 5 | B3 (N-14): a browser without `showModal`; "Add expense" tapped twice (the panel opens over itself), then "Bread" ₹50 saved | Saved once; the sheet closes | `Bread 5000` on the server, sheet closed |
| 6 | B3 on a copy without `endPanel()` in `openExpense` | The old hook clears `form`, so the save does nothing | Nothing saved, the sheet stays open: the probe catches the old bug |
| 7 | RELEASE_TESTING.md M9–M13, worked by hand from shares and settle-ups (Asha, Ben, Chitra; Ben paid Asha ₹40, Chitra paid Asha ₹100) | M9 (Dinner ₹600 by Asha, 3 ways): Asha +600−200−40−100 = +260, Ben −200+40 = −160, Chitra −100. M10 (paid by Ben): Ben +440, Asha −340, Chitra −100. M11 (split Asha and Ben): Ben +340, Asha −440, Chitra +100. M13 (₹40 → ₹50): Ben +350, Asha −450; deleted: Ben +300, Asha −400. Each sums to 0 | The guide's texts say exactly these; the re-run dry run showed them |
| 8 | The policy's deletion lines (section C) | `foreign_keys` on, deleting the `groups` row cascades to `people`, `expenses`, `expense_split` (`server/db.js` migration 1); the path is `RAILWAY_VOLUME_MOUNT_PATH` + `/splitfamilia.db` (`dataDir`, `DB_FILE_NAME`) | Schema and path as stated; `T-06-deletion-check.mjs` re-run: the same as recorded |
| 9 | Section 12's steps against the UI | People → Remove (blocked with "Can't remove someone who appears in an expense…"); an expense or payment → Delete → confirm; "Your groups" → Edit → "Remove from this device" | All present (`index.html` 1410–1447, 1660–1668, 1038–1090) |
| 10 | Section 4: after "Remove from this device", "a change still waiting to be sent is still sent the next time the app is online" | — | The outbox runs inside an open group (`startApp`, `index.html` 1816–1871; the T-04 review's P5). It is sent the next time any group is open while online, not merely when the app is: **N-22** |
| 11 | "It sets no cookies" (sections 2, 9), which also depends on Railway's edge | No `Set-Cookie` | 0 on `/`, `/index.html`, `/healthz`, `/privacy.html` (404 until deployed) of the live site |
| 12 | Android, clean clone of `5f51b22` plus the 43 files; `twa-manifest.json` as cloned before T-06, then re-checked out with T-06's `.gitattributes` staged | Before: CRLF, SHA-1 ≠ `manifest-checksum.txt`; after: LF, SHA-1 = the checksum (N-18). The bundle keeps `raw/web_app_manifest` (F-15) | Before: 46 CR bytes, `8874269…`; after: 0, `19959be…` = the checksum. `resources.txt`: `raw/web_app_manifest : reachable=true`; the only unused raw entry is `raw:keep`; `base/res/raw/web_app_manifest.json` in the bundle |

## Findings

Numbered on from the T-05 review (F-15, N-19, O-3).

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| **F-16** | **Medium** | [PRIVACY_POLICY.md:82](../../google-play/PRIVACY_POLICY.md#L82) and [:116](../../google-play/PRIVACY_POLICY.md#L116); [privacy.html:122](../../../privacy.html#L122) and [:158](../../../privacy.html#L158); the same fact in [PLAY_CONSOLE_DECLARATIONS.md:53](../../google-play/PLAY_CONSOLE_DECLARATIONS.md#L53) and [:113-115](../../google-play/PLAY_CONSOLE_DECLARATIONS.md#L113-L115) (from T-05) and the cross-check rows [PRIVACY_POLICY.md:295](../../google-play/PRIVACY_POLICY.md#L295). The code: [server/api.js:89-117](../../../server/api.js#L89-L117) (an address is pruned only when it is looked up again; past 10,000 the oldest is dropped), [server/live.js:28](../../../server/live.js#L28) and [:72](../../../server/live.js#L72) (held while a stream is open) | One request from an address that never returns → still in memory 11 minutes later, and a week later (adversarial example 1). Expected by the policy: gone within 10 minutes. An open page's address is held for as long as the page stays connected | The public policy, and the declarations' reasoning for not declaring IP addresses, misstate how long the server keeps an address. SF-017's "from verified behaviour only" and its required test "every factual sentence traces to code" are unmet for these two sentences. Nothing is published yet (the page is a draft and T-06 isn't deployed), but **a push of T-06 would put the sentence live** | **Change requested.** Recommended: make the code keep the promise. Give `createAddressLimiter` a `sweep()` that drops every address with no event inside the window, run it from `createApp` on a timer (`unref()`, cleared on close), and test it with the fake clock (unseen for longer than the window plus one sweep → `size()` drops) plus a break check. Then say, in both policy files and the declarations: in memory only, while its page keeps a live connection open and for at most N minutes after its last request (N from the window plus the sweep interval), never stored or logged. A text-only fix ("until the server restarts") is possible but weaker. This touches T-08's limiter: re-run the server tests and `T-08-break-checks.mjs` |
| N-20 | Note | [PRODUCTION_RELEASE_CHECKLIST.md:38-40](../../google-play/PRODUCTION_RELEASE_CHECKLIST.md#L38-L40) | The pre-ticked "No production secrets committed" lists what the audit didn't find, but not what it did: one of the family's group codes (a password for a group, by the policy's own words) is in public history (D-21) | A reader of the checklist alone wouldn't know. The audit and the readiness report do say it | Add "history keeps one old family group code in a test example (D-21, accepted)" to the line |
| N-21 | Note | [T-06-implementation.md:142](T-06-implementation.md#L142) | The receipt cites `T-06-build-transcripts.txt` for N-18's check ("LF checkout, checksum matches"), but the transcript has no N-18 section | The claim had no recorded evidence. This review verified it (example 12; [T-06-review-output.txt](T-06-review-output.txt) section 10) | Point the receipt's N-18 cell at this review's output |
| N-22 | Note | [PRIVACY_POLICY.md:75](../../google-play/PRIVACY_POLICY.md#L75), [privacy.html:115](../../../privacy.html#L115) | "is still sent the next time the app is online": the outbox runs only while a group is open | Small inaccuracy; it errs towards telling the user more is sent, not less | Say "the next time a group is open in the app while online", in both files, with F-16 |
| O-4 | Observation (tooling) | `T-06-review-probe.mjs` | `Network.emulateNetworkConditions` sent to the sessions of a closed tab's service worker never answers: three 20-second timeouts in the second run, with no effect on the results (the offline step worked) | A slower probe only | In later probes, drop a server's sessions when its tab closes |

Accepted as designed: the implementation's decisions D1–D12 (D6, the bar inside the topmost
dialog, is confirmed by examples 2–4). The T-04 review's carried items F-13, N-9, N-10 and N-12
still need no change.

## Commands and results

| Check | Command | Result |
|---|---|---|
| Input | the receipt's digest command (Git Bash) | 43 files, `7c0a2d6f…`, the same; per-file hashes equal; unchanged after the break checks |
| Full suite | `npm test` (Node 24.21.0) | **226/226** in the tree; 226/226 in the clean clone |
| Break checks | `node docs/planning/evidence/T-06-break-checks.mjs` | **13/13 caught**, files restored |
| Checklist against the brief | `node docs/planning/evidence/T-06-checklist-diff.mjs .` | the same as recorded: 37/37, nothing missing |
| Final audit | `bash docs/planning/evidence/T-06-audit.sh` | no new hit; differences only in docs edited after the first run |
| Real codes in git | `node docs/planning/evidence/T-06-codes-check.mjs` | the same as recorded: history only (D-21) |
| Browser dry run | `node docs/planning/evidence/T-06-browser-check.mjs . <scratch> <shots>` (headless Edge, 360 px) | the same as recorded (IDs, dates and the order of equal rows aside); no errors, dialogs or timeouts |
| Review probe | `node docs/planning/evidence/T-06-review-probe.mjs . <scratch>` | Part A: F-16. B1, B2, B3 pass; both break runs caught |
| Deletion steps | `node docs/planning/evidence/T-06-deletion-check.mjs . <scratch>` | the same as recorded |
| Live site cookies | `curl -s -o /dev/null -D - https://splitfamilia.up.railway.app<path>` (read-only) | no `Set-Cookie` |
| Android | clean clone outside OneDrive + the 43 files; throwaway key (deleted); `./gradlew --no-daemon clean lintRelease bundleRelease`; `jarsigner -verify`; `bundletool validate`; `T-05-android-checks.mjs` | BUILD SUCCESSFUL in 1 m; lint 0 errors, 14 warnings; `jar verified.` (throwaway signer); valid; **17/17**; F-15 and N-18 as in example 12; key folder, then build folder deleted |

Not exercised: the app on a phone (D-20: the owner's internal-testing launch); the Docker image
(no Docker here; the wiring tests check what it ships); `railway ssh` and Railway's Restart (no
access to the owner's account); a screen reader (the accessibility tree was checked instead); the
policy's legal sufficiency (the owner's, PC-010).

## Acceptance checklist

| Story | Criterion | Verdict |
|---|---|---|
| SF-017 | Covers every listed topic | Met (17 sections; `tests/privacy.test.js` checks the headings) |
| SF-017 | …from verified behaviour only | **Not met:** sections 5 and 10's IP-address retention (F-16). Every other statement checked holds (examples 7–11) |
| SF-017 | Placeholders, LEGAL/OWNER INPUT REQUIRED on each legal choice, no named law | Met (five placeholders, including `<RESPONSE_TIME>`) |
| SF-017 | Play's account-deletion page quoted with the date checked, and the conclusion | Met (section B, 2026-10-02) |
| SF-017 | How the owner handles a deletion request, and the response time (OWNER) | Met, on Railway as the card's 2026-09-30 note says (section C; re-run here) |
| SF-017 | Consistent with SF-016; a cross-check table for each data type | Met as a table with no mismatch between the two docs, but its IP row carries the same wrong fact in both (F-16) |
| SF-017 | Required: every factual sentence traces to code or a cited page | **Not met** (F-16) |
| SF-018 | `privacy.html` matches the policy, app styling, reads well at phone width | Met (test; 360 and 800 px without sideways scroll) |
| SF-018 | Linked from the welcome screen and the group menu (the card's T-04 note) | Met, outside anything hidden in the app (test K7) |
| SF-018 | In the worker's shell, opens offline; cache bumped | Met (`splitsheet-v8`; worker test; dry run O5) |
| SF-018 | Owner gate: the Draft note, `pending_deployment`, a pending check | Met (PC-010, with the cache bump and a byte-identical check) |
| SF-018 | The URL in STORE_LISTING.md and PLAY_CONSOLE_DECLARATIONS.md | Met |
| SF-018 | F-14 and N-14 (the T-04 review) | Met (dry run E3 and F-14; probe B1–B3 and their break runs) |
| SF-018 | Required (manual): both links open the page; it opens offline | Met (dry run S5, O5) |
| SF-019 | Every item of brief stage 7; "Not in this app" with a reason | Met |
| SF-019 | Steps and hand-worked results | Met (M1–M14 recomputed, example 7) |
| SF-019 | Offline, slow network, backend errors, restart, deep links, Android versions, screen sizes, the Play-signed build | Met; Android 5–8 an honest, recorded gap (D-20) |
| SF-019 | Internal → Closed → Production; the closed-testing rule marked VERIFY IN PLAY CONSOLE with the page and date | Met |
| SF-019 | Automated tests run and recorded; a browser dry run | Met (`test:rules` gone with Firebase); dry run re-run here |
| SF-019 | N-17 | Met |
| SF-020 | Every brief box word for word under the same headings | Met (37/37) |
| SF-020 | This app's checks (with the card's Railway replacements), who does each, with links | Met |
| SF-020 | Only repo items with evidence pre-ticked; nothing account-dependent | Met (8 ticked); one ticked line's wording, N-20 |
| SF-021 | Tree and history searched for each audit item; commands and results in PRODUCTION_AUDIT.md | Met (re-run) |
| SF-021 | Each hit classified; real secrets escalated, not rewritten | Met (D-21) |
| SF-021 | `assetlinks.json` placeholders flagged | Met (a release blocker) |
| SF-021 | `npm test`, lint and `bundleRelease` re-run; success only if it ran | Met (and re-run here) |
| SF-021 | READINESS_REPORT.md with the seven sections | Met |
| SF-021 | The same report given to the owner in chat | Not verifiable from the repository (chat isn't kept); the file exists |
| SF-021 | The Railway additions; `git ls-files` free of keystores, bundles, data | Met |
| SF-021 | F-15 and N-18 (the T-05 review) | Met (verified in this review's build, example 12); N-18's evidence was missing from the transcript (N-21) |

## Decision and follow-up state

- **`changes_requested`.** STATE: T-06 `status` `changes_requested`, `review_receipt` this file,
  a `review_outcomes` entry, `next_phase` `implementation` (the rework), the task's note updated
  (D-21 answered), and a history line. F-16, N-20, N-21 and N-22 are on the SF-017, SF-020 and
  SF-021 cards.
- **The rework (one implementation conversation):** F-16 (code and text, recommended above),
  N-22 with it, N-20, N-21. Then `npm test`, the privacy test's break checks, the T-08 break
  checks for the limiter, and the browser dry run (the policy text changes). No new cache bump is
  needed while `splitsheet-v8` is undeployed (phones have v7), but re-check that at the time.
  Then a fresh review.
- **Production verification:** `pending_deployment`, unchanged. **Don't push T-06 before the
  rework is accepted:** the push would publish F-16's sentence on the live site, even under the
  Draft note.

## Second review: the rework

- **Review context:** a fresh conversation, 2026-10-02, about 07:54–08:15 IST, on the owner's
  "continue". It wrote none of the reviewed code, neither T-06 nor its rework. Outputs:
  [T-06-review2-runs-output.txt](T-06-review2-runs-output.txt),
  [T-06-review2-probe-output.json](T-06-review2-probe-output.json) (from
  [T-06-review2-probe.mjs](T-06-review2-probe.mjs)),
  [T-06-review2-browser-check-output.json](T-06-review2-browser-check-output.json); breaks in
  [T-06-review2-breaks.mjs](T-06-review2-breaks.mjs).
- **Reviewed input:** verified, **yes**. Nothing had drifted from the receipt.
  - The digest command at the top of the implementation receipt gives
    `fd61c458ab25db2db547f399e4359eb507aba2f8dfc145607554d349d13fdddb` over 59 files, the
    "Rework" section's value. The 38 files listed in the receipt's two tables match their SHA-256
    (the 23 rework rows, and the 15 rows the rework left alone at their first values).
  - The same digest again after every break run. `HEAD` and `origin/main` are both `5f51b22`.
  - This review changed no app, server, test, hosting or Android file (its edits are listed
    under "Decision and follow-up state").
- **Verdict: `accepted`.**
  - F-16 is fixed in the code, not only in the text. The limiters forget an address within one
    sweep after its last event leaves the window. Both policy files and the declarations state
    that bound and the live-connection case, and `tests/privacy.test.js` ties the stated minutes
    to the code's constants. N-20, N-21 and N-22 are done.
  - Every acceptance criterion of SF-017 to SF-021 is now met.
  - One new note, **N-23** (a test gap: X6 below), is not an unmet criterion. It is a follow-up
    on the SF-017 card.

### Contract checked and adversarial examples

Expected values were worked out by hand, from the policy's sentences and `server/api.js`, before
running anything. Q1–Q3 come from this review's own probe. It runs the real server in-process on
127.0.0.1, with a temporary database, the production limits, a fake clock and a 25 ms sweep.
Addresses are RFC 5737 ones sent as `X-Real-IP` behind the proxy setting.

| # | Input | Expected (by hand) | Observed |
|---|---|---|---|
| Q1 | A guesser makes 30 unknown-code reads, one at a time. A writer creates a group and sends 300 changes to it. A watcher keeps a live stream open on that group. Sizes are `[guess limiter, change limiter, hub]`, then the clock moves 10 min − 1 ms, then 1 ms more. Then the stream closes and the guesser returns with the known code | 30 × 404, then 429. 300 × 200, then 429, and the writer can still read (200). Sizes: `[2, 1, 1]`, because the new group counts as one unknown code. One ms before the window ends: `[2, 1, 1]`, and the guesser is still blocked. At the window's end: `[0, 0, 1]` (the stream's address stays). Stream closed: `[0, 0, 0]`. The guesser's return: 200, and still `[0, 0, 0]`, because reading a known group records nothing | As expected, in every step |
| Q2 | 10,000 addresses in the guess limiter, inserted alternately: even ones at 0, odd ones at 5 min. Swept at 10 min, then at 15 min | At 10 min an event at exactly the cutoff is gone (`<=`), so 5,000 are left (0 even, 5,000 odd). At 15 min, 0. Deleting while `Map.forEach` walks must skip nothing | 5,000 (0 even, 5,000 odd), then 0 |
| Q3 | The worst sweep: 10,000 addresses (the limiter's cap) × 300 changes each, all expiring at once | Every one forgotten, in a single short pause | 0 left. 131.6 ms (142 ms while Edge was also running). 1.2 ms when nothing has expired. This needs 10,000 distinct real addresses each sending 300 changes in the same 10 minutes. The cost is paid once, where before it was spread over later requests. Acceptable: no finding |
| Q4 | The real 30 s interval (`T-06-rework-probe.mjs`, re-run) | Forgotten within one sweep after the window. The stream's address is held after the window and dropped when the stream closes | Pass: forgotten 27.8 s after the window. The stream was held, then dropped |
| Q5 | The policy's words against the code. Section 5 says the server keeps the address "while a live connection from the app is open … and for at most 11 minutes after the last request from that address". Section 10 says the same | The limiters record an event only for an unknown code or a new group, and for a change. Each of those is a request, so the last event comes no later than the last request: 10 min + 30 s ≤ 11 min. The hub holds only open streams. `server/main.js` overrides no window or sweep, so the test's constants are production's. Nothing else holds an address | Holds. The group answers (`answers`) are keyed by code. The log lines carry no address (`server/api.js` 261, 382, 388, 449). The stream request records no limiter event for a known group |
| Q6 | Section 4 (N-22): "the next time a group is open in the app while online" | The outbox runs inside `startApp`, and `sendAll` sends every group's waiting changes | Holds (also section E row 4) |
| Q7 | The declarations' code table, after the lines moved | Each of the 10 links into `server/` lands on what it describes | All 10 land on the right lines, including the sweep (`api.js` 130–134), its timer (`server.js` 60–67) and the hub (`live.js` 44–45, 72) |
| Q8 | The browser dry run (RELEASE_TESTING.md, the privacy page, F-14) re-run, compared with the rework's recorded run | The same, apart from random IDs and the order of rows with equal amounts | 21 differences, all of those kinds. M5's extra paisa went to Ben, whose ID sorted first, which is D8's rule. The privacy page has 17 sections, the Draft note and no fonts, no sideways scroll at 360 or 800 px, and opens offline. F-14: the bar sits inside the open sheet, on top and not ignored by accessibility, and its × hides it with the sheet still open. No errors, dialogs or timeouts |

### Findings

Numbered on from the first review (F-16, N-22, O-4).

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| **N-23** | Note | [tests/privacy.test.js:87](../../../tests/privacy.test.js#L87) | Break X6 removes section 5's live-connection clause in both files alike and keeps section 10's. `npm test` still passes, because `assert.match` finds the clause once, anywhere in the policy. Expected: a failure, as for the minutes, which are counted per section (`stated.length === 2`) | A later edit could make section 5 understate how long an open page's address is held. Today's text is right in both sections (Q5) | Follow-up, not blocking: count the clause like the minutes (exactly 2 matches, sections 5 and 10), and add X6 to `T-06-break-checks.mjs`. On the SF-017 card |

No other finding. The rework's decisions R1–R4 are accepted. R1 (11 minutes for a 10.5-minute
bound) leaves room for a late timer. R3 (no cache bump) still holds: `origin/main` is `5f51b22`,
which serves `splitsheet-v7` and has no `privacy.html`.

### Commands and results

| Check | Command | Result |
|---|---|---|
| Input | the receipt's digest command (Git Bash); per-file `sha256sum` | `fd61c458…`, 59 files; 38 of 38 hashes equal; the same after every break run |
| Full suite | `npm test` (Node 24.21.0) | **230/230** |
| T-06 break checks | `node docs/planning/evidence/T-06-break-checks.mjs` | **20/20 caught**, files restored |
| This review's breaks | `node docs/planning/evidence/T-06-review2-breaks.mjs .` | X1 (only one limiter swept), X2 (a 90 s sweep), X3 (the sweep forgets live addresses too), X4 (`sweepMs` ignored) and X5 (the hub keeps a closed stream's address) **caught**. X6 **not caught**: N-23. Files restored and checked by SHA-256 |
| T-08 break checks (the limiter is T-08's) | `node docs/planning/evidence/T-08-break-checks.mjs`; `node docs/planning/evidence/T-08-review-breaks.mjs` | **20/20**; R1, R2 and R4–R8 caught, R3 skipped, as recorded (its text left `server/api.js` in T-09) |
| Probe | `node docs/planning/evidence/T-06-review2-probe.mjs .` | Q1–Q3 as above |
| The real sweep interval | `node docs/planning/evidence/T-06-rework-probe.mjs` | pass, 27.8 s |
| Browser dry run | `node docs/planning/evidence/T-06-browser-check.mjs . <scratch> <shots>` (headless Edge, 360 px) | Q8 |
| Release checklist | `node docs/planning/evidence/T-06-checklist-diff.mjs .` | 37/37, nothing missing |
| Real codes in git | `node docs/planning/evidence/T-06-codes-check.mjs` | history only, as recorded (D-21) |
| Final audit | `bash docs/planning/evidence/T-06-audit.sh`, diffed with `T-06-audit-output.txt` | No new secret pattern or assignment. The new lines are counts in files written since the first run: mentions of "token" and "secret", 127.0.0.1 in the review and rework probes (local servers), Firebase in the receipts. Others are moved line numbers. None is in a shipped file |

Not re-run, because nothing they cover changed since the first review (hashes equal): the Android
build (no `android/` file changed in the rework; F-15 and N-18 were confirmed in the first
review's clean-clone build) and the deletion steps (`server/db.js` is unchanged). Not exercised,
as before: a phone (D-20), the Docker image, `railway ssh`, a screen reader.

### Acceptance checklist: the changed rows

| Story | Criterion | Verdict |
|---|---|---|
| SF-017 | …from verified behaviour only | **Met now:** sections 5 and 10 state the bound the code keeps (Q1–Q5). Section 4's wording holds (Q6) |
| SF-017 | Required: every factual sentence traces to code or a cited page | **Met now:** section E rows 4, 5 and 10 point at the code (Q5, Q7) |
| SF-017 | Consistent with SF-016; the cross-check table | Met: the IP row is now true in both documents (Q5, Q7) |
| SF-020 | Only repo items with evidence pre-ticked | Met. N-20 is done: the ticked line says D-21's code stays in history, without naming it |
| SF-021 | F-15 and N-18 (the T-05 review) | Met. N-21 is done: the receipt points N-18 at the first review's output, section 10 |

Every other row of the first checklist stands; their files are unchanged.

### Decision and follow-up state

- **`accepted`:** T-06 is `done`, with a `review_outcomes` entry for this review. Every planned
  task is now done. T-07 is stretch, so it starts only if the owner promotes it. STATE's
  `next_task` is null.
- **N-23** is on the SF-017 card.
- **New pending check PC-011:** right after the owner's push of T-06, a session checks the live
  site: `/healthz`, every page file byte-identical to the commit, `privacy.html` live with its
  Draft note, and no cookie.
- **Files this review wrote or edited:**
  - new: `T-06-review2-probe.mjs`, `T-06-review2-probe-output.json`, `T-06-review2-breaks.mjs`,
    `T-06-review2-browser-check-output.json` and `T-06-review2-runs-output.txt`;
  - edited: this receipt, `STATE.json`, `HANDOFF.md`, the SF-017 card, and the two status lines
    of READINESS_REPORT.md that said T-06 awaited this review.
- **Production verification:** `pending_deployment`, unchanged. Nothing was committed, pushed or
  deployed.
  - Pushing T-06 is a production deploy. It needs the owner's word (D-5). It redeploys Railway
    with the web files and `server/api.js` and `server/server.js`.
  - The privacy page then goes live with its Draft note, which SF-018's gate allows. PC-010
    covers the approved version.
  - Re-check at push time that `origin/main` still serves `splitsheet-v7`. If it does, `v8` is
    right; otherwise bump.
