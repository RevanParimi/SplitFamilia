# T-09 review receipt — Move the app and the data to Railway, then remove Firebase

- **Task:** T-09. Stories: [SF-035](../stories/SF-035.md), [SF-036](../stories/SF-036.md),
  [SF-037](../stories/SF-037.md), [SF-038](../stories/SF-038.md). Implementation receipt:
  [T-09-implementation.md](T-09-implementation.md).
- **Review context:** a fresh conversation, 2026-09-30, about 22:45–23:55 IST. It wrote none of
  the reviewed code. T-09 was implemented in the conversation that
  reviewed T-08's rework.
- **Reviewed input:** verified, **yes**. Nothing had drifted from the receipt.
  - All 33 rows of the receipt's table match their SHA-256 on disk (`sha256sum -c`). They
    matched again after both break-check runs.
  - `index.html` is CRLF on disk, as the receipt says; the other files are LF.
  - This review changed no app, server, script, test, hosting or guide file. It added its own
    probe, break checks and output files, and edited only planning files (listed under
    "Decision and follow-up state").
- **Verdict: `accepted`.**
  - Every acceptance criterion of SF-035 to SF-038 is met. So are D-18 (a), N-5, N-6 and N-7.
  - D1 to D10 are accepted.
  - New findings are all low: **F-11**, **F-12** and **F-13**. There are also notes N-8 to N-12
    and one observation about the test harness, O-2. None is an unmet criterion, and none
    stops the switch-over.
  - One note, **N-11**, is an owner step before the guide's step 3: every phone must have
    nothing waiting to sync on the old app. It is now step 6 of PC-006.

## Contract checked and adversarial examples

Expected values were worked out by hand from the cards, `REVIEW.md` and `server/api.js`'s
contract before running anything.

Rows P1–P4 and R1–R7 come from this review's probe,
[T-09-review-probe.mjs](T-09-review-probe.mjs) ([output](T-09-review-probe-output.json)). It
runs the real page, server and copy script on 127.0.0.1, with temporary databases, headless Edge
over CDP, a made-up import token and test groups only.

| # | Input | Expected (by hand) | Observed |
|---|---|---|---|
| P1 | **The import token.** `POST /api/import` with no `Authorization`, a wrong token, the token upper-cased, two spaces after `Bearer`, `bearer` in lower case, and the token plus a trailing space. A server whose token is 23 characters. `GET /api/import` with the endpoint on and off. Then 60 wrong tokens in a row, and a read of an unknown code | Only `Bearer <token>` gets in: everything else 404. A trailing space is trimmed by HTTP itself, so it gets in. 23 characters: off, so 404. The import is counted by neither limit, so 60 wrong tokens are all 404 and the next unknown code is still a plain 404 | Exactly: 404 × 5, 200 for the trailing space, 404 for the short token; 60 × 404; then 404. **A `GET` answers 405 while the endpoint is on and 404 while it's off** (N-9) |
| P2 | **The copy and its check.** Meera (`meera1`), Kabir (`kabir2`) and someone removed (`ravi-gone`). "Houseboat" ₹10,000.01 by Meera, split all three; "Ferry" ₹9.99 by Kabir, split Meera and Kabir | Before: 404. The import creates it: 2 people and 2 expenses added, version 1. Sorted IDs `kabir2` < `meera1` < `ravi-gone`: 1000001 ÷ 3 = 333333 r 2, so Kabir and Meera 333334 each, Ravi 333333. 999 ÷ 2 = 499 r 1: Kabir 500, Meera 499. **Meera +1000001 − 333334 − 499 = +666168; Kabir +999 − 333334 − 500 = −332835; Ravi −333333**; sum 0. The read-back matches | Exactly: 404; created, 2 and 2 added, version 1; 1000001 and 999 stored; balances 666168 / −332835 / −333333; `matches: true` |
| P3 | **The copy run again by mistake after the switch-over.** On Railway, the family deletes the Ferry and adds "Snacks"; then the same import again | Nothing added, and the version unchanged (3). The deleted Ferry stays deleted, because its ID is still stored. Snacks stays. The read-back check then **refuses** to say "matches" | Exactly: 0 and 0 added; version 3 before and after; expenses x1 and x3; `matches: false` |
| P4 | The import with one more expense, after a read has built the group's shared answer | The version moves to 4, so the next read is built again and shows it | Version 4; x1, x3 and x4 |
| R1 | **D3: a new group started with no connection.** "Trek" offline, then Asha and Ben, then the page reloaded while still offline, then back online | "offline: 3 changes waiting to sync" (the create counts). No group on the server. The reload is served by the worker, with both people marked waiting. Online: the create goes first, then the people, and the bar says "live". Server: ₹, version 1 + 2 = **3** | Exactly |
| R2 | **Two tabs, and a refusal in the middle of the queue.** Both tabs on Trek, both offline. Tab B removes Ben; no expense names him yet. Meanwhile another phone adds "Fuel" ₹60.00 by Ben, split Asha and Ben. Tab A adds Chitra, then "Dinner" ₹90.00 by Asha, split Asha and Chitra. Then both go online | The queue: B's removal, then Chitra, then Dinner. The removal gets 409 `in-use`, is dropped with one plain message, and the rest still goes. Each change is sent once. Fuel 3000 each; Dinner 4500 each. **Asha +9000 − 4500 − 3000 = +1500; Ben +6000 − 3000 = +3000; Chitra −4500** → "Chitra owes Ben ₹30.00", "Chitra owes Asha ₹15.00". Ben reappears. Server version 3 + Fuel + Chitra + Dinner = **6** | Exactly, in both tabs. One `DELETE` (409), one people `POST`, one expense `POST`. The notice was "Couldn't remove Ben. That person is in an expense now, so they can't be removed. Delete their expenses first.", shown in whichever tab sent it. While offline, tab A said 3 changes waiting and tab B said 1 (N-10) |
| R3 | **A second tab of a group started offline.** Tab A starts "Hike" offline; tab B opens its link, still offline; then both go online | Only one tab sends the create. Both should then go live | Tab A "live". **Tab B still "connecting…" after 15 s**, with one `PUT` in all; B went live only after a reload (F-11) |
| R4a | **An offline open of a group this phone never read.** Another phone made "lake" (€; Isha and Omar; "Tickets" €10.01 by Isha, split both). Open its link offline, then go online | The app from the worker. The phone has no copy, so an empty group and "offline: changes will sync when you're back online". Online: "live". 1001 ÷ 2 = 500 r 1, so Isha 501 and Omar 500 → "Omar owes Isha €5.00" | Exactly. Offline the page showed no people and **₹** (N-8) |
| R4b | The link of a code no group has, opened offline, with a person added; then online | "Not syncing", a "No group found…" message, and nothing created on the server | Exactly: "not syncing"; no group on the server |
| R4c | The same, but the currency symbol is changed to "$" offline instead | Nothing created: only "Start a new group" should create a group | **The server now has that group, with "$", at version 1**, while the page says "not syncing" and "No group found…" (F-12) |
| R5 | `notgithub.io`, a host that merely contains "github.io", mapped to 127.0.0.1 | The app runs as usual, with no "moved" card | The start screen; no "moved" card |
| R6 | Every server log line (74) and browser console line (114) from the probe, against the codes, names, descriptions and the token | None holds any of them | **No leaks.** The server's lines are only `SplitFamilia api: <method> <status> <code>` |
| R7 | The offline reopen, five times: the server stopped, the tab offline, Trek's link | Each time the app from the worker, with the phone's copy (3 people) and "offline: …" | 5 of 5 |

The implementer's browser check B1–B8 was re-run (second run, [output](T-09-review-browser-check-output.json)).
This run's random IDs sorted Ben < Chitra < Asha, so the values were worked out again:
- **B3.** Hotel: Ben 3334, Chitra 3333, Asha 3333. Chai: Ben 2, Chitra 2, Asha 1. **Asha
  +10000 − 3333 − 1 = +6666; Ben +5 − 3334 − 2 = −3331; Chitra −3335**; sum 0. That gives
  "Chitra owes Asha ₹33.35" and "Ben owes Asha ₹33.31". The page showed exactly these.
- **B4.** Taxi 12500 each. **Asha −5833, Ben +9166, Chitra −3333**. That gives "Asha owes Ben
  ₹58.33" and "Chitra owes Ben ₹33.33". The page showed exactly these.
- B1, B2 and B5–B8 were as in the receipt: `splitsheet-v6` with its 10 entries; never "live"
  while Dev waited; the offline reopen; Join; and "moved" on a GitHub Pages name.
- 0 errors and 0 dialogs. Only Google Fonts' hosts. The only `?g=` request was B8's, as GitHub
  Pages.

Traced by hand in the code:
- `PUT /api/group` is an upsert (`server/api.js` lines 370–378). So a create whose answer was
  lost is confirmed when it is sent again, and the new group's live connection still starts.
  The flip side is F-12.
- Every change bumps the version, including `setCurrency` (`server/db.js` line 110), and so does
  an import that adds anything. A group's answer is cached per version and a 404 is never cached,
  so no read can get a stale answer. RB2 and P4 confirm this.
- `outbox.js`: a refused change is removed and the queue goes on; a change that must wait stops
  the queue there. So a later change never overtakes a waiting one (C8, R2).
- `forBalances` gives `amountPaise / 100`, and `toPaise` rounds `× 100`. For every p ≤ 10⁹ the
  double's error is below 2.3 × 10⁻⁷, far under ½, so the paise always come back exactly. That
  covers the whole range, not only the test's sample.
- The old page stored `date` as `toISOString()` and `amount` as a number (`a8bffb8`,
  `index.html` lines 1113–1119). So the family's expenses fit the server's shape checks, and
  anything that doesn't is listed by the dry run.

## Findings

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-11 | **Low.** Confirmed (R3) | `index.html` lines 1100–1133 and 1348: `waitingForCreate` is cleared only in this tab's `onConfirmed` | **Trigger:** start a group with no connection, open its link in a second tab before the create is sent, then go online. **Observed:** the tab that sent the create goes live; the other stays "connecting…" (15 s and more) and never starts its live connection until reloaded. **Expected:** both go live once the server has the group | That tab never hears others' changes and its bar never says "live". Its own changes still reach the server, so no data is lost. It needs two tabs of a group created offline, which is rare | → SF-022's card. When a flush finds the create gone from the outbox (`waitingForCreate && !creating()`), start the watch. Add it to the browser check (R3) |
| F-12 | **Low.** Confirmed (R4c) | `index.html` lines 1300–1308 (the currency change is queued as `kind: "group"`); `ledger-client.js` line 62 (sent as `PUT /api/group`); `server/api.js` lines 370–378 (`PUT` creates an unknown group) | **Trigger:** open the link of a code no group has (a typo, or a group never copied), offline or online, and change the currency symbol. **Observed:** the server creates that group with the new symbol, while the page says "not syncing" and "No group found…". **Expected:** only "Start a new group" (`create: true`) creates a group | A stray empty group appears. Opening that link again then shows an empty group instead of "No group found", which could make someone think they are in the right group. Once groups can be deleted (SF-024), a currency change waiting on a phone would bring a deleted group back. No data is exposed or lost | → SF-022 and SF-024 cards. Only a create should create: for example `PUT` answers 404 for an unknown code unless the body says `create`. That needs the page and the server together, so it's easiest after the switch-over. Or the page doesn't queue a currency change for a group it hasn't read |
| F-13 | **Low.** Test gap, confirmed by break checks | `scripts/move-from-firestore.mjs` line 191 (the expense count in the read-back check); `server/api.js` line 332 (the import's people cap counts the people already in the group) | **RB6:** drop the count from the check. **RB7:** count only new people. `npm test` stays green (11/11 and 44/44) | The code is right today, and the dry run and read-back cover the family's copy. But nothing would notice if either guard went: an expense that nets to zero (paid by one person and split only with them) could go missing while the check says "matches" | Accepted as is: both run only at the switch-over, on the token holder's word. If the script or the import changes before the copy, add a test for each (break checks RB6, RB7) |
| N-8 | Note (not a regression: Firestore behaved the same) | `index.html` lines 1335–1349 (`copy` is `null` and the view is `EMPTY_GROUP`) | R4a: an offline open of a group this phone never read shows no people, no expenses, and the symbol ₹, with "offline: changes will sync when you're back online" | Someone may add people or expenses that already exist, and they'd be doubled once online | → SF-028's card: when the phone has no copy and the group isn't new, say so ("Not loaded yet. Connect to see this group.") instead of an empty ledger |
| N-9 | Note | `server/api.js` lines 134 and 344 | P1: `GET /api/import` answers 405 while the endpoint is on and 404 while it's off, so anyone can tell when it is on. Wrong tokens are never limited, by design | None in practice. The token is 32 random characters (`randomBytes(24)`), and the endpoint is on only between the guide's steps 2 and 6. The receipt's "a wrong token looks like no such path" holds for `POST` | Optional. If `api.js` is touched again before the move, answer 404 for any method on `/api/import` unless the token is right |
| N-10 | Note | `outbox.js` (each tab's `waiting` list) | R2: while offline, tab B counted 1 change waiting while 3 waited on the phone. A refusal's message shows in whichever tab sent the change | Both tabs converged on the same ledger and "live". Nothing is lost | None needed |
| N-11 | Note: an inference from the old page's code, not run | The switch-over guide, "Before you start" and step 3; the old page's `persistentLocalCache` (`a8bffb8`, `index.html` line 700) | A phone that added an expense offline on the **old** app keeps it waiting in Firestore's cache. If that phone comes online after step 3 (Firestore read-only), the write is refused and dropped, and the copy at step 4 never sees it | An expense lost at the switch-over | **Owner step before the guide's step 3** (added to PC-006 as step 6, and to HANDOFF): each phone opens the old app online and the bar says "· live", not "waiting to sync" |
| N-12 | Note | `.gitignore` lines 2 and 42–47 | The header still says "The Firebase web config in index.html is public by design and stays tracked", and the Firebase tool lines are unused | None: `.gitignore` isn't shipped | Tidy it when D-12 moves the files |
| O-2 | Observation about the checks, not the app | `T-09-browser-check.mjs` line 89 (`waitForDebuggerOnStart: true`), and this review's probe with `--sw-pause` | See "Commands and results": with new workers paused for the debugger, CDP sometimes stalled. The first browser-check run stopped at B6 with Edge's own offline page. One probe run hung; two stopped at R3 | The page's offline start held every time the harness didn't stall: the second B6 run, R1's offline reload, R4a–R4c, and R7's 10 reopens in two modes. The service worker's cache lookup is unchanged since T-03's accepted review | Future browser checks attach without pausing workers, as this probe now does by default |

The implementer's decisions:
- **D1 (the worker fetches `./index.html` without `?g=`; `#g=` links wait for OWNER CONFIRMATION
  REQUIRED): accepted.** C2 catches it. The browser check saw no `?g=` on the Railway-like origin
  after the first visit.
- **D2 (the `fonts.gstatic.com` preconnect removed): accepted.** The fonts still load.
- **D3 (a new group's live connection waits for its create): accepted**, with F-11's two-tab
  case as a follow-up (R1).
- **D4 (only a 4xx other than 408 and 429 drops a change): accepted** (R2; C6, C8).
- **D5 (two pushes): accepted.** Push A alone passed `npm test` 155/155 again. Its image is T-08's
  17 files, with the page files identical to `HEAD`.
- **D6 (codes and token from git-ignored files; the terminal shows counts and fingerprints):
  accepted** (R6; the script's tests). `/data/` is in `.gitignore`.
- **D7 (what the copy leaves out, and "NO — decide before copying"): accepted.**
- **D8 (D-18 (a)): accepted.** Re-measured: see "Commands and results".
- **D9 (the leftover paisa goes to the first UUID): accepted.** Every phone agrees; the person is
  random per group, as with Firestore's IDs.
- **D10 (the old Firestore cache stays on phones): accepted.**

## Commands and results

All on this machine: Node 24.21.0, 2026-09-30 (IST). Outputs:
[T-09-review-runs-output.txt](T-09-review-runs-output.txt),
[T-09-review-probe-output.json](T-09-review-probe-output.json) and
[T-09-review-browser-check-output.json](T-09-review-browser-check-output.json).

| Check | Command | Result |
|---|---|---|
| Input hashes | `sha256sum -c` over the receipt's 33 rows; `file index.html` | All OK, and again after both break runs. `index.html` CRLF |
| Full suite | `npm test` | **180/180** pass (about 7 s) |
| The implementer's break checks | `node docs/planning/evidence/T-09-break-checks.mjs` | **22/22 caught** (C1–C22); every file restored byte for byte |
| This review's break checks | `node docs/planning/evidence/T-09-review-breaks.mjs` ([script](T-09-review-breaks.mjs)) | **5 of 7 caught**: RB1 (the "moved" check takes `notgithub.io`), RB2 (a stale shared answer), RB3 ("live" while changes wait), RB4 (any token length) and RB5 (duplicate people in an import). **Missed: RB6 and RB7** (F-13). Every file restored byte for byte |
| Push A alone | `git archive HEAD` into a scratch folder, plus push A's 10 files, then `node --test "tests/*.test.js"` | **155/155**. Compared with `HEAD` (CR removed), these are identical: `index.html`, `money.js`, `group-code.js`, `sync-status.js`, `service-worker.js`, `manifest.json`, `server/static.js`, `Dockerfile` and `.dockerignore` |
| Image check | `node docs/planning/evidence/T-08-image-check.mjs <empty dir>`, on the full tree and from the push A folder | Full tree: **19 files** (with `ledger-client.js` and `outbox.js`); page files byte-identical with all headers; private paths 404; `storage: volume`; versions 1–4; no code in the log. Push A: **T-08's 17 files**; `/ledger-rules.js` 404, as in T-08 |
| Browser check | `node docs/planning/evidence/T-09-browser-check.mjs <repo> <empty dir>` (headless Edge) | **First run stopped at B6**: `navigator.serviceWorker` was undefined, so Edge showed its own offline page (O-2). **Second run: B1–B8** as worked out above; 0 errors |
| Read cost (D-18) | `node --expose-gc docs/planning/evidence/T-09-read-cost-probe.mjs` | The largest group: **5.2 MB, 1.3 MB gzipped**. Its first read took 932 ms, the second 52 ms. While ten unread reads were held, `/` answered in **30 ms**; memory went from 139 to 122 MB. A rebuild after a change holds the server 430–488 ms (L2). The 5,001st expense and the 20,001st entry get 409 `group-full`. 100 × 200: 1.4 MB, 0.1 MB gzipped |
| This review's probe | `node docs/planning/evidence/T-09-review-probe.mjs <repo> <empty dir>` | Rows P1–P4 and R1–R7 above; about 90 s; no CDP timeouts. Earlier runs are in the runs output. The first run paused new workers and completed with the same results, except that its P1 imported P2's group early; that is fixed. The next three runs paused workers and stalled in CDP (O-2). One more without pausing matched the final run |

Not exercised: a Docker build (no Docker here), Railway's live edge (the stream through its proxy,
`X-Real-IP`), a real phone, the copy against the real Firestore, and anything the owner does in
the Railway or Firebase consoles. All of these come at the switch-over (PC-006, PC-007).

## Acceptance checklist

| Story | Criterion | Verdict |
|---|---|---|
| SF-035 | No Firebase SDK or config; data calls go only to the page's own API, through `ledger-client.js?v=6` | Met (wiring test, C3, C20; the browser check saw only Google Fonts) |
| SF-035 | "Join" asks the API: a 404 shows "No group found…", and offline shows the offline message | Met (B7; `index.html` lines 780–795) |
| SF-035 | "Start a new group" creates the group with its currency at once | Met (B2: version 1, ₹; R1 offline) |
| SF-035 | Live updates keep the ledger current, and each reconnect reads the whole group once | Met (B5, R2, R4a; `onVersion`) |
| SF-035 | Every error people see comes from `friendlyError`, never the server's text; F-6 gets its own text | Met (C4; R2 and R4b notices; `page-client.test.js`) |
| SF-035 | The worker drops `SDK`, never caches `/api/`, still starts offline; the cache name and `?v=` are bumped | Met (C1; B1 `splitsheet-v6`; B6, R1, R7) |
| SF-035 | The start-up panel still covers a page that can't start | Met (the start-up script is unchanged from T-03's accepted review) |
| SF-035 | One group per page load (F-3) | Met (`openGroup`'s guard; Join disables Start) |
| SF-035 | Names and descriptions reach the screen through `textContent` | Met (read in the code, including `refusedText`) |
| SF-035 | `tests/wiring.test.js`: no shipped file mentions `firebase`, `firestore` or `gstatic` | Met (C5, C20; grep of the shipped files) |
| SF-036 | The phone's copy in IndexedDB, keyed by the code inside storage; an offline open shows it at once, with "offline: …" | Met (B6, R7; N-8 for a group never read) |
| SF-036 | The outbox: IDs from `crypto.randomUUID()`, kept in IndexedDB, sent in order, removed only when confirmed; sending twice is harmless; a refused change is dropped with one plain message and never retried forever | Met (`outbox.test.js`, `page-client.test.js`; R2; C6, C8) |
| SF-036 | Honest status: "live" only when connected with nothing waiting; deletes counted; rows not on the server say "waiting to sync" | Met (B4, B5, R1; C7, C9, RB3). F-11 is a tab that never reaches "live", not a false "live" |
| SF-036 | Balances while changes wait include them | Met (B4, R2 offline) |
| SF-036 | Two phones: both adds kept; deleting what is already deleted is harmless | Met (`page-client.test.js`; R2) |
| SF-037 | A script, not shipped, reads each group from Firestore's REST API, with or without a group document; codes are never in the repo | Met (the tests; the image has no `scripts/`). The codes come from a git-ignored file (D6) |
| SF-037 | A dry run first: counts, balances and payments from `money.js`, flagged expenses listed, groups over the limits (split entries too) listed | Met (the tests; C14) |
| SF-037 | The import: only while `IMPORT_TOKEN` is set; the token never committed, printed or logged; IDs kept; `toPaise`; a re-run adds nothing | Met (P1–P4, R6; C13, RB4, RB5) |
| SF-037 | After the import, a read-back compares every balance to the paisa | Met (P2, P3; C12). F-13 is a test gap in a second guard |
| SF-037 | Running it against production needs the owner's word | Met (the guide; nothing was run against production) |
| SF-038 | A switch-over guide with the order, and each owner step labelled | Met. `MOVE_FROM_FIREBASE.md` refines the card's order with push A, the token and turning the token off again (D5). N-11 adds an owner step before step 3 |
| SF-038 | The old address shows "SplitFamilia has moved", keeping the group; `localhost` still works | Met (B8, R5; `group-code.test.js`; C19, RB1) |
| SF-038 | Removed: `firestore.rules`, `firebase.json`, `tests/rules/`, the devDependencies (lock regenerated), `test:rules` and `FIRESTORE_RULES.md`; `CLAUDE.md`, `README.md` and `REVIEW.md` describe the Railway server | Met (the deletions in `git status`; `package.json`; the docs read). N-12 is a stale `.gitignore` comment |
| SF-038 | `npm test` checks that nothing in the image mentions Firebase, Firestore or gstatic | Met (C5, C20) |
| SF-038 | Pending checks written against the code | Met: PC-006 and PC-007, checked against the code. PC-006 gains step 6 (N-11) |
| SF-038 | N-5: `/healthz` 503 without a database | Met (C18) |
| SF-038 | D-18 (a): 20,000 split entries; one shared answer per version; gzip; measured again | Met (C15–C17, RB2; the read-cost probe) |
| SF-038 | N-6: "quickly" in the comment; the monthly volume check | Met (`server/api.js` line 8; `HOSTING_RAILWAY.md` 3a step 5) |

## Decision and follow-up state

- **`accepted`:** T-09 is `done`, with a `review_outcomes` entry for this review.
- Cards noted: SF-022 (F-11, F-12), SF-024 (F-12) and SF-028 (N-8).
- PC-006 gains **step 6** (N-11, the owner, before the guide's step 3). PC-007 gains **step 5**
  (optional, the owner: an offline open on a real phone).
- Files this review wrote or edited:
  - new: this receipt, `T-09-review-probe.mjs`, `T-09-review-probe-output.json`,
    `T-09-review-breaks.mjs`, `T-09-review-runs-output.txt` and
    `T-09-review-browser-check-output.json`;
  - edited: `STATE.json`, `HANDOFF.md`, and the SF-022, SF-024 and SF-028 cards.
- Production verification: `pending_deployment`. Nothing was committed, pushed or deployed.
  - The switch-over now follows [MOVE_FROM_FIREBASE.md](../../google-play/MOVE_FROM_FIREBASE.md),
    one owner step at a time, each on the owner's word: push A → PC-006 → `IMPORT_TOKEN` →
    every phone "live" on the old app (PC-006 step 6) → Firestore read-only → the dry run → the
    copy → push B → PC-007.
  - Push A is exactly the guide's 10 files. Push B is everything else, including this review's
    files.
