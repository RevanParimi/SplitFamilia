# T-03 review receipt — Database rules, offline start, honest sync status, the SplitFamilia name and Railway hosting

- **Task:** T-03. Stories: [SF-007](../stories/SF-007.md), [SF-008](../stories/SF-008.md),
  [SF-009](../stories/SF-009.md), [SF-010](../stories/SF-010.md), [SF-011](../stories/SF-011.md).
  Implementation receipt: [T-03-implementation.md](T-03-implementation.md).
- **Review context:** a fresh-session review in a new conversation, 2026-09-30, about
  06:43–07:05 IST. This session wrote none of the reviewed code, and it did not reuse the
  implementation's self-checks as its own. T-03 was already on `main` (commit `6f3b3fe`, pushed
  2026-09-29 on the owner's word) and live on GitHub Pages and Railway.
- **Reviewed input:** verified, **yes**. Nothing had drifted from the receipt.
  - All 23 files in the receipt's table match their SHA-256 on disk (`sha256sum -c`), and the four
    files it lists as unchanged from T-02 still match (`cd8a67e4…`, `d8f418fb…`, `308bd7a9…`,
    `10ee363d…`).
  - The committed blobs (`git show HEAD:<file> | sha256sum`) match for 22 of them. `index.html`
    differs only in line endings: it is CRLF on disk and LF in git, and
    `git show HEAD:index.html | sed 's/$/\r/' | sha256sum` gives the receipt's `f3d5afce…` (N-2).
  - `git diff 8898b50 -- index.html service-worker.js manifest.json | sha256sum` →
    `6756e517…` (3 files, 522 insertions, 126 deletions), matching the receipt.
  - The working tree was clean at the start. The review changed no app, rules, test or hosting
    file: every break check ran in a scratch copy, and each copy was restored byte-identical.
- **Verdict:** `accepted`. Every acceptance criterion of all five stories is met, and there is no
  critical or high finding. One medium finding (F-5) and two low ones (F-6, F-7) are follow-ups
  on T-04's cards.

## Contract checked and adversarial examples

Expected values were worked out by hand from the story cards and `REVIEW.md`, not taken from the
code. Rows 1–8 come from the review's own probe,
[T-03-review-probe.mjs](T-03-review-probe.mjs) (output:
[T-03-review-probe-output.json](T-03-review-probe-output.json)). It ran the **real page and the
real Firebase SDK** in headless Edge **against the Firestore emulator running the repo's
`firestore.rules`**, the first time T-03 met a real server. The implementation's run R had to
block Firestore entirely, so it never showed "live". The served page was rewritten to the
project `demo-splitfamilia` and connected to the emulator, and **0 requests** went to
`firestore.googleapis.com`. People's IDs are Firestore's random ones. In the recorded run they
sort Chitra `HBIe…` < Asha `d35Q…` < Ben `eLRr…` (code units: `H` < `d` < `e`).

| # | Input | Expected (by the contract, worked out by hand) | Observed |
|---|---|---|---|
| 1 | Online. "Start a new group" "Review trip"; add Asha, Ben, Chitra; Asha pays **₹100.00** split among all three; Chitra pays **₹0.05** split among all three | 10000 p ÷ 3 = 3333 r 1 → Chitra 3334, Asha 3333, Ben 3333. 5 p ÷ 3 = 1 r 2 → Chitra 2, Asha 2, Ben 1. Asha 10000 − 3333 − 2 = **+6665**; Ben −3333 − 1 = **−3334**; Chitra −3334 + 5 − 2 = **−3331**; sum 0 → "Ben owes Asha ₹33.34", "Chitra owes Asha ₹33.31". Stored: `amount` 100 and 0.05 as numbers, the group document `{currency: "₹"}`, and the bar reaches "live" | Exactly these balances. The emulator holds `amount: 100` and `0.05`, the split IDs, a 24-character ISO date and `{currency: "₹"}`. The bar said "· live" 3.8 s after Start (first visit, with the worker installing) |
| 2 | Offline (page and worker offline, the emulator blocked). **Delete "Tea"** | The ledger shows Dinner only: Asha +6667, Ben −3333, Chitra −3334 → "Chitra owes Asha ₹33.34", "Ben owes Asha ₹33.33". The bar counts the waiting delete: "offline: 1 change waiting to sync" (D12: a pending delete counts as 1) | Balances exact. **The bar said "· offline: changes will sync when you're back online"**, so the delete isn't counted (**F-5**) |
| 3 | Still offline. Ben pays **₹50.00** "Taxi", split Chitra and Ben | 2500 each: Ben −3333 + 2500 = −833; Chitra −3334 − 2500 = −5834; Asha +6667 → "Chitra owes Asha ₹58.34", "Ben owes Asha ₹8.33". The row says "waiting to sync"; the bar says "offline: 2 changes waiting to sync"; the server still has Dinner and Tea | Balances and the row exact; the server has Dinner and Tea. **The bar said "offline: 1 change waiting to sync"** (F-5) |
| 4 | Back online | The mark clears; the bar reaches "live"; the server has Dinner (100) and Taxi (50), and no Tea | "· live" after 0.3 s, the mark gone, the server exactly so. The status log of the whole page: connecting… → "1 change waiting to sync" ⇄ live for each online write → offline → "offline: 1 change waiting to sync" → "1 change waiting to sync" → live |
| 5 | The browser says online, but the server is unreachable (new requests to the emulator blocked). **Delete "Taxi"** and watch the bar for 20 s; then Asha pays ₹10 "Snacks" for herself | The bar never says "live" while the server still has Taxi. The add shows as waiting | **"· live" every second for 20 s while the server still held Taxi (F-5).** After the add: "· 1 change waiting to sync". Unblocked: both changes reached the server within 4.4 s (Dinner, Snacks), "· live", balances back to the Dinner-only values (Snacks nets 0) |
| 6 | A 61-character name, with the input's `maxlength` removed (as a page without it would send) | Refused by the rules; a plain message, never Firestore's; the typed text never in the console; nothing stored | Refused; nothing stored; console `SplitFamilia: Couldn't add that person. permission-denied`, and the name nowhere in it. Message: "Couldn't add that person. **This group can't be opened. Check the invite link.**", shown under a bar that says "· live" (F-6) |
| 7 | 48 more people through the form (51 in all), then an expense split among all 51 through the form | The page offers it, so it should either save it or say why not. The rules take at most 50 | The expense appeared, was refused, and vanished; nothing stored. Message: "Couldn't save that expense. This group can't be opened. Check the invite link." (**F-6**) |
| 8 | Reopen the invite link (the worker in control) | "connecting…", then "live"; the cache holds one `/index.html`, no `?g=` key, the 7 shell URLs and the 2 SDK files | Exactly: connecting… at 70 ms, live at 295 ms; `splitsheet-v5` as expected. 0 page errors, 0 dialogs in the whole run |
| 9 | The implementer's browser check, re-run unchanged (fake Firebase for F1–F9; the real SDK with Firestore blocked for R1–R4) | The receipt's results | The same on every point: F-3 fixed (F1, F2: one group, writes to it); the plain messages (F3–F5); the install button and iPhone tip in a tab, hidden standalone and after an `android-app://` referrer, including after "Switch group" (F6–F8); the start-up panel at 10 s and gone once the SDK arrives (F9); offline reopen with "offline: 3 changes waiting to sync" and "Ben owes Asha ₹45.00" (R2); panel within 2.6 s with gstatic blocked, native submit prevented (R4) |

The balances in rows 1–5 show `money.js`'s invariants still hold end to end: the shares of each
expense sum to its total, the leftover paise go to the first IDs in code-unit order, and
balances sum to zero after offline edits.

## Findings

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-5 | **Medium** (the honest-status invariant fails for deletes; no data is lost) | `sync-status.js` 23–32 (`countPending`); `index.html` 1109 and 1122–1124 (the two deletes); `tests/sync-status.test.js` 45–48 | Delete an expense or a person while the server can't confirm it. Firestore 12.17.1 raises the query snapshot after a local delete with `metadata.hasPendingWrites` **false**: the deleted document leaves the view, and nothing left in it is pending. So `countPending` returns 0. **Observed:** online but unreachable, "· live" for 20 s and more while the server still held the expense (row 5). Offline, the delete isn't counted (rows 2 and 3). **Expected:** "live" only when the server has confirmed what's on screen (`REVIEW.md`, SF-009's intended result); D12 counts a pending delete as 1. The unit test "a pending delete leaves no document behind but still counts as 1" uses a snapshot shape the SDK doesn't produce, so it can't catch this | On a weak connection (common on a trip, where the phone still says it's online), someone deletes a wrong expense, sees "live" and closes the app. Other phones keep showing and counting that expense until this phone reconnects. The delete isn't lost: it waits in the phone's queue and syncs later (row 5) | Follow-up → **SF-022** (T-04, the next story to change the page's writes), noted on its card. Not a blocker: every SF-009 criterion is met, including the card's own manual test (rows 3–4), and no data is lost |
| F-6 | Low | `index.html` 1150–1158 (no limit on the split) against `firestore.rules` 50 (`split.size() <= 50`); `sync-status.js` 6 | A group with 51 or more people, and an expense split among everyone (every box ticked). **Observed:** refused, with "Couldn't save that expense. This group can't be opened. Check the invite link." while the bar says "live" (row 7). Every write the rules refuse gets the same "invite link" text (row 6; the implementation's F4). **Expected:** the page doesn't offer what the rules refuse, and a refused write says what's wrong. `npm test`'s limits check (D4) covers name, description, currency, amount and code, but not the split | Unlikely for a family (51 or more people), but then no everyone-split expense can be saved, and the message points at the invite link instead of the cause. Old pages meet the same text only through L10 | Follow-up → **SF-028** (T-04: form checks and messages), noted on its card |
| F-7 | Low (test gap) | `tests/rules/firestore-rules.test.js` 122–131 | Break check R9: `allow delete: if true;` for people. **Observed:** 15/15 still pass. The bad-codes test tries `get`, `list`, `set` and `add` under each bad code, never `delete`. **Expected:** a test fails. The rules themselves are right (lines 61 and 67) | SF-022 and SF-023 edit these rules in T-04. A slip there could drop the code check on deletes unnoticed | Follow-up → **SF-022**, noted on its card |
| N-2 | Note (records) | T-03 receipt, "Review input" | The receipt says every hashed file is LF on disk; `index.html` is CRLF there, and the committed blob is LF with the same content | None; the hash is right for the file as it was | For later receipts: hash committed files as `git show HEAD:<file> \| sha256sum`, as HANDOFF suggests |
| N-3 | Note (product decision already made) | D-4; T-02 receipt L1 | Once the rules are deployed, a group's code is its only protection. The family's group has an old-style code made from its name, so it can be guessed; only new groups get a random part | Anyone who guesses the code could read or change the family's ledger, with or without the rules. The rules stop listing and enumeration, not guessing | No action unless the owner asks. Moving the family to a new group would mean copying its data, and nothing does that today |

Reproductions:

- **F-5:** run the probe (header gives the command); rows 2, 3 and 5 are `E2_offline` and
  `E6_onlineButUnreachable` in its output. By hand: open a group, delete an expense with DevTools
  set to Offline. The bar says "offline: changes will sync when you're back online", not
  "1 change waiting to sync". For the "live" case, block the Firestore host in DevTools'
  request blocking without going Offline, then delete an expense.
- **F-6:** in the probe, `E4a_nameTooLong` and `E4b_split51`. By hand, on the emulator: add 51
  people, then an expense with every box ticked.
- **F-7:** in a scratch copy (see below), change `allow delete: if validGroupId(gid);` under
  `people` to `allow delete: if true;` and run the rules tests: 15 pass.

Fix ideas, for T-04 to choose from:

- **F-5:** count the page's own unconfirmed deletes. Add each delete to a set, and empty it when
  `deleteDoc`'s promise settles, which happens only on the server's answer. Or use Firestore's
  `waitForPendingWrites(db)`, which also covers writes queued by an earlier session. Replace
  the test's premise with the real behaviour. Then re-run probe rows 2, 3 and 5: expect
  "offline: 2 changes waiting to sync" at row 3, and no "live" at row 5 until the server has the
  delete.
- **F-6:** refuse a split of more than 50 in the form, with a plain message, and add the split to
  the wiring test's limits check. Give a refused write (`permission-denied` from a write) its own
  text, for example "That change doesn't fit this group's limits. Reload the app and try
  again.", and keep "This group can't be opened…" for a stopped listener.
- **F-7:** in "denied: codes the app would never make", also try deleting a person and an
  expense, and the new update from SF-022, under each bad code. Then confirm R9 fails.

Checked and found fine (no finding):

- **Rules.** There is no `list` on `groups`, and collection-group queries match no rule. `NaN` and
  `Infinity` fail the amount comparisons (tested). D1's extra bounds fit what the app writes (row
  1: a 24-character date, 20-character IDs). A merge that adds a field to a group is refused,
  because `update` sees the merged document (tested). T-02's two new kinds of access, the new
  group's `{currency: "₹"}` and "Join"'s `get` and `list … limit(1)`, work from the real page
  under the real rules (row 1).
- **Worker.** Both SDK files are kept once and served cache-first. One `/index.html` is kept
  whatever the `?g=` (row 8). A redirected response is never kept (R4 caught). `keep()` isn't
  awaited, as before T-03; a lost background refresh only means the next open refreshes again.
- **Page.**
  - Every name and description reaches the screen through `textContent`. No `.message` appears
    anywhere (a wiring test; R8 caught a leak).
  - `appStarted` is declared after `openGroup()`, but it is read only from event handlers, which
    run after the module finishes.
  - `groupExists()`'s 15-second timeout can't cause a stray `unhandledrejection`, because
    `Promise.race` handles both promises.
  - The start-up script's capture-phase `error` listener reacts only to failed `<script>`
    elements, so a failed font doesn't raise the panel.
- **Live hosting** (checked by this review, about 06:57 IST).
  - `https://splitfamilia.up.railway.app` sends `Cache-Control: no-cache`, `nosniff` and the
    referrer policy on `/`, `index.html`, `service-worker.js`, `sync-status.js?v=5`,
    `manifest.json` and `assetlinks.json` (as `application/json`).
  - `firestore.rules` and `docs/planning/STATE.json` return 404.
  - The seven app files are byte-identical to `HEAD`.
  - GitHub Pages still serves every repo file, docs included, as the SF-011 card and
    `HOSTING_RAILWAY.md` section 6 say, until the owner turns it off.
- **Guides.** `FIRESTORE_RULES.md` and `HOSTING_RAILWAY.md` match the files and the live service.
  Every owner step is labelled **MANUAL ACTION REQUIRED**, and the Play signing key's location
  is labelled **VERIFY IN PLAY CONSOLE**.

## Commands and results

All runs were on this machine: Windows 11, Node v24.21.0, Eclipse Temurin 21.0.12.1 (its `bin`
put first on `PATH`, since `java` wasn't on this session's `PATH`) and headless Microsoft Edge,
on 2026-09-30 IST.

| Check | Command | Result |
|---|---|---|
| Input verification | `sha256sum -c` on the receipt's 23 files; `git show HEAD:<file> \| sha256sum`; `git diff 8898b50 -- index.html service-worker.js manifest.json \| sha256sum` | All match (the `index.html` line endings are N-2) |
| Full suite | `npm test` | **72 passed, 0 failed**, exit 0, 0.32 s. No install, no network, no Firestore |
| Rules on the emulator | `npm run test:rules` | **15 passed, 0 failed**, exit 0; clean shutdown; the emulator's `firestore-debug.log` deleted |
| Reviewer break checks against `npm test` (a scratch copy of the app files and tests; the working tree never edited) | 8 mutations, each followed by `node --test "tests/*.test.js"` | **8 of 8 caught**: R1 pending checked after `fromCache` (1 failed); R2 "live" before every listener has heard (1); R3 SDK not served cache-first (3); R4 a redirected page kept (1); R5 description `maxlength` 201 (1); R6 rules currency limit 4 (1); R7 `Dockerfile` without `assetlinks.json` (1); R8 `friendlyError` showing the error's own message (1). 72/72 before and after; files restored byte-identical |
| Reviewer rules break checks on the emulator (a scratch copy: rules, the test file, `package.json`, a `firebase.json` without a `rules` entry, and a `node_modules` junction, removed as a link afterwards; this avoids L13) | `npx firebase emulators:exec --only firestore --project demo-splitfamilia "node --test tests/rules/firestore-rules.test.js"` | Control **15/15**. R9, `allow delete: if true` for people: **15/15, not caught (F-7)**. R10, an empty split allowed: 1 failed ("denied: an expense that isn't ledger-shaped"). Rules restored byte-identical; no emulator left on port 8080 |
| Reviewer's probe | `npx firebase emulators:exec --only firestore --project demo-splitfamilia "node docs/planning/evidence/T-03-review-probe.mjs <repo> <empty scratch dir>"` (run from the repo) | Rows 1–8 above. Two runs: the second added row 5 and the page's status log, and it is the recorded one. Both gave the same results for rows 1–4 and 6–8 (their IDs sorted differently, and the hand-worked balances matched each). 0 page errors, 0 dialogs, 0 requests to the real Firestore |
| Implementer's browser check, re-run | `node docs/planning/evidence/T-03-browser-check.mjs <repo> <empty scratch dir>` | Row 9: every F and R result as in the receipt. 0 Firestore responses; 46 Firestore requests tried and blocked; run R's 26 errors are all `ERR_INTERNET_DISCONNECTED` resource logs while offline; run F's 2 are the ones F5 throws on purpose |
| Live hosting | `curl -sS -D -` on 8 paths of the Railway and GitHub Pages sites; bodies of the 7 app files against `git show HEAD:` | As under "Checked and found fine" |
| Cleanup | Processes and files | No Edge (scratch profile) or emulator `java` left running; the scratch junction removed as a link; the repo's `node_modules` intact; `git status`: only this review's new files |

Not exercised:

- building the Docker image here (Railway's builds are now the real ones, PC-003);
- a real phone, an installed PWA or the Android app (L4, on SF-012);
- iOS Safari, and Chrome (only Edge ran);
- the real Firestore, by design (PC-002 comes after the owner's rules deploy).

## Acceptance checklist

| Story | Criterion | Verdict |
|---|---|---|
| SF-007 | `firestore.rules`, and `firebase.json` with only a `firestore` section, committed | Met (`6f3b3fe`) |
| SF-007 | Default deny; the listed gets, creates, updates, lists and deletes, with the card's shapes and limits | Met (rules 53–68; row 1; 15/15). D1's extra bounds on `date` and `paidBy` fit the app |
| SF-007 | `gid` matches the SF-005 pattern, at most 80 characters | Met (18–20; wiring test; the bad-codes test) |
| SF-007 | Denied: listing `groups`, collection-group queries, updates to people and expenses, extra fields, any other path | Met (emulator tests; R10 caught). Deletes under a bad code are denied by the rules but untested (F-7) |
| SF-007 | The UI's `maxlength` matches the rules; cache bumped | Met (60, 200 and 3; `splitsheet-v5`). The split has no UI limit (F-6); the card doesn't ask for one |
| SF-007 | Emulator tests under a `demo-` project for every allow and deny, run by `npm run test:rules`; `npm test` network-free | Met, with F-7's gap |
| SF-007 | Deploy is the owner's action, with the command and a pending check | Met (`FIRESTORE_RULES.md` section 3; PC-002) |
| SF-007 | The receipt records PC-001 for the rollback target | Met |
| SF-008 | The shell and the versioned SDK files available offline, the choice recorded; everything else cross-origin goes to the network | Met (D6; worker 17–67; tests; row 8) |
| SF-008 | A start-up panel with Retry if the SDK can't load or start; no native form submit | Met (R4, F9 re-run) |
| SF-008 | After one visit, airplane mode shows the ledger from Firestore's cache | Met (R2 re-run) |
| SF-008 | Cache bumped | Met (`splitsheet-v5`, `?v=5`) |
| SF-008 | Manual tests: offline reload; site data cleared then offline; gstatic blocked | Met, except where impossible: with nothing cached and no network, the page itself can't load, so no panel can show (L3). The panel shows whenever the page loads (R4) |
| SF-008 | T-02's F-4: the worker's version protections tested | Met (`tests/service-worker.test.js`; R3 caught) |
| SF-009 | Status from snapshot metadata with `includeMetadataChanges`, plus online and offline events | Met; deletes aren't reflected (F-5) |
| SF-009 | Unsaved ledger rows marked "waiting to sync" | Met (row 3; cleared in row 4) |
| SF-009 | A pure function maps the five codes and a default; no raw messages | Met (tests; R8 caught) |
| SF-009 | The console gets at most the code; no typed text or group codes | Met (row 6; F3–F5) |
| SF-009 | A global `error` / `unhandledrejection` handler shows one friendly message | Met (F5) |
| SF-009 | Manual: offline → "offline"; add → "waiting to sync"; online → mark clears and "live"; a permission error → the friendly text | Met, **now against a real server for the first time** (rows 2–4; row 6) |
| SF-009 | T-02's F-3: one group per page load | Met (F1, F2 re-run) |
| SF-010 | Standalone, or an `android-app://` referrer → no install button and no iPhone line; a normal tab unchanged | Met (F6–F8). A real install and the real TWA are still to try (L4 → SF-012) |
| SF-010 | SplitFamilia in the manifest, `<title>`, the headings and the Apple title; `splitsheet-` and `splitsheet-group` kept, as a recorded decision | Met (D17; wiring test; live Railway) |
| SF-011 | The `Dockerfile` copies only the app's files, backed by `.dockerignore` | Met (wiring test; R7 caught; live: rules and docs 404) |
| SF-011 | Listens on `$PORT`; serves `/.well-known/…`; the four headers | Met (live Railway, this review) |
| SF-011 | `railway.json`; `assetlinks.json` with `com.splitfamilia.app` and marked placeholders, and where each comes from | Met (`HOSTING_RAILWAY.md` section 5) |
| SF-011 | Invite links, the manifest `id`, `start_url` and `scope` unchanged; no `http://` or `localhost` in shipped files | Met (wiring tests) |
| SF-011 | A local server check (Docker missing: the same server binary) | Met (the implementation's Caddy transcript), and since then the real Railway build (PC-003 steps 1, 2 and 5) |
| SF-011 | The owner's steps labelled **MANUAL ACTION REQUIRED**, including moving phones off GitHub Pages; a pending check | Met (`HOSTING_RAILWAY.md`; PC-003) |

## Decision and follow-up state

- **Accepted.** STATE changes made by this review:
  - T-03 is now `done`, with `review_receipt` set and a `review_outcomes` entry.
  - `active_task` and `next_task` are now T-04, with `next_phase` `implementation`.
  - A history line was added.
- Follow-ups written on the cards:
  - **SF-022**: F-5 (count unconfirmed deletes) and F-7 (deletes under bad codes in the rules
    tests).
  - **SF-028**: F-6 (the split limit in the form, and the text for a refused write).
  - `REVIEW.md`'s honest-status invariant now says that deletes count too.
- **Production verification:** stays `pending_observation`. T-03 is live on GitHub Pages and
  Railway, and Railway's files were re-checked here. Still waiting on the owner:
  - PC-004 step 2: open the family group on the phone;
  - PC-003 steps 3 and 4: the family's own invite link on Railway, then add and delete a test
    expense;
  - PC-002, after the owner deploys the rules (`FIRESTORE_RULES.md` section 3). Nothing in this
    review stands in the way of that deploy, and the page's limits match the rules. Only the
    split limit differs (F-6), and it needs 51 or more people.
