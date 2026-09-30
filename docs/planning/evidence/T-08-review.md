# T-08 review receipt — Railway backend: a small Node server, the SQLite database, the ledger API and live updates

- **Task:** T-08. Stories: [SF-031](../stories/SF-031.md), [SF-032](../stories/SF-032.md),
  [SF-033](../stories/SF-033.md), [SF-034](../stories/SF-034.md). Implementation receipt:
  [T-08-implementation.md](T-08-implementation.md).
- **Review context:** a fresh-session review in a new conversation, 2026-09-30, ending about
  17:50 IST. This session wrote none of the reviewed code. It re-ran the implementer's checks
  and added its own probe and break checks.
- **Reviewed input:** verified, **yes**. Nothing had drifted from the receipt.
  - All 25 files in the receipt's table match their SHA-256 on disk (`sha256sum -c`). They
    matched again after every break-check run.
  - `index.html`, `money.js`, `group-code.js`, `sync-status.js`, `service-worker.js` and
    `manifest.json` are unchanged from `HEAD` (`git diff --quiet HEAD -- <file>`).
  - The `Caddyfile` is absent, and its deletion is the only staged change.
  - The review changed no app, server, rules, test or hosting file. It added only its own
    evidence files (listed under Commands).
- **Second review, of the rework (a later fresh conversation, 2026-09-30, about 18:40–19:30
  IST): `accepted`.** See [the section at the end](#second-review-the-rework). T-08 is `done`.
- **Verdict (first review):** `changes_requested`.
  - One SF-033 criterion is not met: "more than 30 requests with unknown codes from one address
    in 10 minutes gives 429". Requests whose bodies arrive after their heads get past it
    (**F-8, high**).
  - Every other criterion of the four stories is met, apart from the page-side items D2 moved
    to SF-035, which this review accepts.
  - One medium follow-up (F-9) needs the owner's numbers (D-17). There are two notes (N-4,
    N-5).

## Contract checked and adversarial examples

Expected values were worked out by hand from the story cards and `REVIEW.md`, not taken from the
code. Rows 1–9 come from the review's own probe, [T-08-review-probe.mjs](T-08-review-probe.mjs)
(output: [T-08-review-probe-output.json](T-08-review-probe-output.json)). It runs the real server
in-process on 127.0.0.1 with temporary databases, and uses raw sockets where `fetch` would tidy
the request.

| # | Input | Expected (by the contract, worked out by hand) | Observed |
|---|---|---|---|
| 1 | **60 `POST /api/people`, each with a different unknown code.** Each on its own connection, all 60 heads sent first and the bodies 300 ms later | At most 30 answers other than 429 (SF-033; `REVIEW.md`: "after 30 unknown codes … every API request … gets 429") | **All 60 got 404** (F-8). The next GET got 429, so the counter did record all 60, but only after answering them |
| 1b | The same 60, each body sent with its head | 30 × 404, then 30 × 429 | 30 × 404, 30 × 429 |
| 1c | 60 held `PUT /api/group` with new codes (creating a group counts as an unknown code, D7) | At most 30 groups created | **60 × 200, 60 groups created** (F-8) |
| 2 | Ben pays **₹100.01** ("Chai ☕", 10001 paise), split Chitra, Asha, Ben (in that order) | 10001 ÷ 3 = 3333 r 2. The two leftover paise go to the first two IDs in code-unit order, asha and ben: asha 3334, ben 3334, chitra 3333. Balances: asha −3334, ben 10001 − 3334 = **+6667**, chitra −3333. Sum 0. Stored as the INTEGER 10001; the split returned in the order sent | 201. Returned `amountPaise` 10001, split `["chitra","asha","ben"]`; SQLite `typeof` integer. `money.js` on the returned data: asha −3334, ben +6667, chitra −3333, sum 0 |
| 2b | `amountPaise` as `3334.0`, `1e3`, `"3334"`, `3334.5`, `0`, `-1`, `1000000000`, `1000000001`, 2^53+1, `true`, `null` | JSON numbers equal to a whole number in 1 to 1,000,000,000 are stored as that integer; everything else is 400 `amountPaise` | `3334.0` → 3334, `1e3` → 1000, 1000000000 → stored, all integers. The other eight: 400 `amountPaise` |
| 3 | **A replay after a delete:** add "Tea"; delete it; send the add again with changed text; send the delete again. Then two sends of one new ID at once | Add 201, delete 200, replayed add 200 with nothing brought back and the version unchanged, replayed delete 200. The twins: one 201 and one 200, one row, one split row | Exactly. The version stayed 4; the row is still marked deleted, with the first text. The twins gave 201 and 200, with 1 expense row and 1 split row |
| 4 | **Two streams on group A, one on B, one on an unknown code;** then A gets an expense; then every socket closes | A's two streams hear version 2 at once, then 3. B hears only its 1. The unknown code gets 404. After closing, the hub holds nothing and its timer stops | Exactly. Both A streams got versions 2 and 3; B only 1; the unknown code 404. Headers: `text/event-stream`, `no-store`, `Connection: close`, `nosniff`. After closing: 0 streams, 0 groups, timer off |
| 5 | **36 paths that aren't the app:** `/..`, `/%2e%2e/…`, `/%2E%2E%2F…`, `/.%2e/`, `/..%2f…`, `/..%5c…`, `/..\…`, `/%5c..%5c…`, `/./index.html`, `/index.html/.`, `/.well-known/../…`, `/%252e%252e/…`, `//package.json`, `/.git/config`, `/.env`, `/.dockerignore`, `/Dockerfile`, `/server/*.js`, `/data/splitfamilia.db`, `/splitfamilia.db(-wal)`, `/ledger-rules.js`, `/ledger-client.js`, `docs/`, `tests/`, `/firestore.rules`, `/index.html%00`, `/INDEX.HTML`, `/index.html;.js`, `/.`, `/%2e`, `/api/../index.html` and its encoded form | All 404 with `nosniff` (SF-031, D11). The app's own four (`/`, `/?g=…`, `/index.html`, `/.well-known/assetlinks.json`) 200 | Exactly: 36 × 404, each with `nosniff`; the four app paths 200 |
| 6 | **Codes and typed text in log lines:** refusals of every kind under the code `secret-family-code`, with names and descriptions containing "Secret"; a code in a query string; the limit reached; then a 500 (the database closed under a running server) | Log lines hold at most a method, a status and an error code. The 500 logs the error's code, never its message | 11 lines such as `SplitFamilia api: POST 400 invalid-argument`, plus the one limit line. None holds the code, a name or a description. The 500: `{"error":"internal"}`, logged as `GET 500 internal (ERR_INVALID_STATE)` |
| 7 | The code header twice; the code only in the query string; the code with spaces around it; codes of 80 and 81 characters | 400; 400; the value as sent (HTTP strips the spaces); 80 is valid (404 unknown), 81 is 400 | 400; 400; 200; 404; 400 |
| 8 | **One address, its own new group:** 100 people, then 2000 of the largest expenses allowed (100-person split, 64-character IDs, a 200-character description), 50 at a time | No card sets a limit here, so this row measures rather than tests (F-9) | All 2000 got 201, in about 9 s (213–244 a second). The database grew to 28 MB, about 14 KB per expense |
| 9 | One address opens as many streams as the server allows (the cap shrunk to 20 for the probe) on a group it just made; then the family opens its stream | No card sets a per-address limit (F-9) | 20 × 200; **the family's stream got 503** |

The stream the page will use (`ledger-client.js`) was not run against Railway's proxy (L6 of the
implementation receipt). Rows 2 and 3 check `money.js`'s invariants end to end: whole paise, the
shares summing to the total, and balances summing to zero, now through the API and SQLite.

## Findings

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-8 | **High.** An acceptance criterion of SF-033 is not met, and the only brake on guessing codes can be bypassed | `server/api.js` 183 (`limiter.blocked` checked), 193 (`await readJson`), 203 (`limiter.hit` recorded) | **Trigger:** `PUT` or `POST` requests with unknown codes, many at once, each body sent after its head. Every request passes the check at line 183 while its body is still on the way, and each is counted at line 203 only after the wait. `GET` and `DELETE` have no body, so they run straight through and are limited correctly. **Observed:** 60 of 60 answered 404, and 60 held `PUT`s created 60 groups (rows 1 and 1c). **Expected:** at most 30, then 429. The limiter tests send one request at a time, so they can't see it. **Repro:** `node docs/planning/evidence/T-08-review-probe.mjs`, `P1_heldBodies` and `P1_heldPuts` | The limit exists to slow guessing of old-style codes made from a group's name. The family's code is one (D-4, N-3), and a code is the only key to a ledger. With this gap, one address can test as many codes per round as it can open connections, for example `POST /api/expenses` with an unknown payer: 404 means "no such group", and 400 `paidBy` means "exists", without writing anything. Nothing is at risk until T-09 copies the family's data (SF-037), but T-08's push puts the API on the internet. It also lets anyone create groups without limit (F-9). Railway's edge was not tested: it is unknown whether it forwards a request's head before its body | **Fix in T-08's rework (SF-033).** Check `limiter.blocked(address)` again right after the body is read, before `ledger.groupVersion(code)`. From there on nothing waits, so no request can get between the check and the count. Add a test that holds 60 bodies, like the probe, and expects at most 30 answers other than 429. Break check: remove the new check, and that test must fail |
| F-9 | **Medium.** No card sets these limits; an inference about abuse, measured | `server/api.js` (no limit on writes to a known group); `server/live.js` 45 (one limit of 1000 streams for everyone) | **Trigger:** anyone makes a group of their own (one unknown code), then from one address: (a) adds expenses as fast as the server takes them; (b) opens streams until the server is full. **Observed:** (a) 2000 of the largest expenses in about 9 s, 28 MB, nothing refused (row 8); (b) with the cap at 20, one address held all 20, and the family's stream got 503 (row 9) | Once T-08 is pushed, the API is public and writes to the owner's Railway volume. (a) can fill the volume and raise its cost; once full, every write fails, the family's too from T-09. (b) would stop the family's live updates from T-09: pages retry every 30 s and keep getting 503 while the streams are held. No one's data can be read this way | **D-17 (open), for the owner's numbers.** Recommended: fold it into T-08's rework, since the push opens the API. For example: at most 300 changes per address per 10 minutes, at most 10 streams per address, and at most 5,000 expenses per group, deleted ones included. SF-037's import uses its own endpoint and token, so these limits wouldn't slow it. Noted on SF-033's card |
| N-4 | Note | `ledger-rules.js` 115 and 128–130 (`isDate`) | `"2026-02-30T00:00:00.000Z"` passes: V8's `Date.parse` rolls it over to 2 March, so it isn't `NaN`. `2026-13-01…` and `…23:59:60Z` are refused | The page always sends `new Date().toISOString()`, which can't produce such a date. Only a direct API call could store one, and the page would show it as 2 March. The Firestore rules took any 1–40 characters | Optional in the rework: also require `new Date(value).toISOString()` to give back the same date and time. Noted on SF-033's card |
| N-5 | Note | `server/server.js` 94–113 (D14) | `/healthz` answers 200 with `"database":"unavailable"` when the file can't be opened. That's intended while the page doesn't need the database | After T-09's switch-over, a deploy that can't open the database would still pass Railway's health check and replace the working one | → **SF-038:** from the switch-over, `/healthz` answers 503 when the database is unavailable, so Railway keeps the last good deploy. Noted on its card |

No other defect was found. The decisions the handoff asked about:

- **D2 (the page left unchanged; SF-033's page-side items moved to SF-035): accepted.**
  - SF-031's own criterion ("The page is unchanged … No cache bump") and T-08's STATE note say
    the page doesn't change, so the card contradicted its own task.
  - Today the page writes to Firestore, whose live rules are open, so no write of it is refused.
    A check before sending would protect nothing until the page talks to this server.
  - SF-035's card now carries all three items: loading `ledger-rules.js` with `?v=N`, refusing
    over `MAX_SPLIT` and `MAX_PEOPLE` before sending, and the new `friendlyError` text.
- **D5 (a delete only marks the row): accepted.** Row 3 shows why it's needed. The cost (deleted
  text stays in the database and its backups) is on SF-017's and SF-024's cards.
- **D7 (after the limit, known codes wait too): accepted as a product trade-off.**
  - Answering only unknown codes with 429 would tell a guesser which codes exist.
  - One more cost: Indian mobile networks often share one public IPv4 address among many
    users. A guesser on the same network could then make a family member wait up to 10
    minutes. That's unlikely for a family app, but worth knowing if someone reports "busy".

## Commands and results

All on this machine: Node 24.21.0, Java 21 (Temurin), 2026-09-30 (IST).

| Check | Command | Result |
|---|---|---|
| Input hashes | `sha256sum -c` over the receipt's 25 rows; `git diff --quiet HEAD -- <each page file>` | All OK, before and after every break run; the 6 page files unchanged |
| Full suite | `npm test` | **136/136** pass |
| Firestore rules on the emulator | `npm run test:rules` (Java 21 on `PATH`) | **15/15**. No emulator left running; `firestore-debug.log` deleted |
| The implementer's break checks | `node docs/planning/evidence/T-08-break-checks.mjs` | **14/14 caught**; every file restored (script's SHA-256 check, then `sha256sum -c` again) |
| The reviewer's break checks | `node docs/planning/evidence/T-08-review-breaks.mjs` ([script](T-08-review-breaks.mjs), [output](T-08-review-breaks-output.txt)) | **8/8 caught**, each file restored byte for byte. R1: no dot-segment check (the URL parser tidies `/%2e%2e/` to `/`). R2: trust `X-Real-IP` everywhere. R3: count only `Content-Length`. R4: a closed stream stays in the hub (4 tests fail). R5: a person only in a split can be deleted. R6: the client keeps retrying an unknown code. R7: the API without `no-store`. R8: reading a group drops each split's first person (5 tests fail) |
| The reviewer's probe | `node docs/planning/evidence/T-08-review-probe.mjs` ([script](T-08-review-probe.mjs), [output](T-08-review-probe-output.json)) | The rows above. F-8 and F-9 reproduce on every run (three runs) |
| Image check | `node docs/planning/evidence/T-08-image-check.mjs <empty scratch dir>` | The same as the implementer's: 17 files staged plus `package.json`; the 9 page URLs byte-identical with all headers; 8 other paths 404; `/healthz` `storage: volume`; versions 1–4; the database on the stand-in volume; no code in the log |
| Browser check | `node docs/planning/evidence/T-08-browser-check.mjs <repo> <empty scratch dir>` (headless Edge) | The same as the implementer's: start screen, worker in control, `splitsheet-v5` with 7 app and 2 SDK files, four 304s on revisit, an offline start with the server stopped, 0 errors, 0 Firestore requests |
| Parity with the rules tests | the 15 tests in `tests/rules/firestore-rules.test.js` against `tests/server-api.test.js` | Each rules case has an API twin, plus F-6, F-7, the people cap, 409, replays, limits, CORS, logs and the guess limit |

Not exercised: building the Docker image (no Docker here); SIGTERM from Railway; `X-Real-IP`, and
whether the edge forwards a request's head before its body (F-8), on Railway's live edge; the
stream through Railway's proxy.

## Acceptance checklist

| Story | Criterion | Verdict |
|---|---|---|
| SF-031 | Built-in modules only; `$PORT`, 8080 by default; serves the app's files | Met (`server/*.js` import only `node:` and relative files, checked by wiring) |
| SF-031 | The Caddyfile's headers on every file, the right content types, ETags with 304 | Met (the static tests; the image check; the browser check's 304s) |
| SF-031 | Everything else 404 with the same headers, including `..` and dotfiles | Met (row 5: 36 paths; break R1 caught) |
| SF-031 | `GET /healthz` 200; `railway.json` uses it | Met |
| SF-031 | The Dockerfile on node 24 Alpine, only the app and the server; the Caddyfile removed; wiring still checks the SHELL and HTTPS | Met (`node:24.21.0-alpine` is the pinned form, D13; B3 caught) |
| SF-031 | The page unchanged, no cache bump | Met (the page files equal `HEAD`) |
| SF-032 | `<DATA_DIR>/splitfamilia.db` on the volume or in `data/`; WAL and foreign keys | Met (tests; the image check's volume) |
| SF-032 | Numbered migrations run once; the four tables; the split's form recorded | Met (the split is a table, D4; row 2 keeps its order) |
| SF-032 | The client's IDs; the same ID twice is harmless | Met (row 3, B5) |
| SF-032 | Bound parameters only | Met (B4 caught; every statement is prepared with `?`) |
| SF-032 | The owner's volume, backups and region steps in `HOSTING_RAILWAY.md` | Met (section 3a; the owner has done them) |
| SF-032 | If the file can't be opened, the page is still served and the API answers 503; the log says why without a code | Met (the test; N-5 for T-09) |
| SF-033 | One set of limits in `ledger-rules.js`; wiring checks the page's `maxlength`s | Met on the server. The page loading it waits for SF-035 (D2, accepted) |
| SF-033 | The six endpoints; no listing | Met |
| SF-033 | The code only in `X-Group-Code`; logs hold at most a method, a status and an error code | Met (rows 6 and 7; B10 caught) |
| SF-033 | The page's error codes; the page's own text for a refused write | Codes met. The text waits for SF-035 (D2, accepted) |
| SF-033 | **More than 30 unknown codes from one address in 10 minutes gives 429**; 16 KB; JSON only | **Not met under concurrent requests (F-8).** The body limit and JSON only are met (break R3 caught) |
| SF-033 | A duplicate `POST` succeeds without a second copy | Met (row 3) |
| SF-033 | Split 1–100, at most 100 people, ID pattern, and the other limits | Met (tests; B7 and B14 caught) |
| SF-034 | An event stream: the version at once and after each change, a heartbeat every 25 s | Met (row 4; tests) |
| SF-034 | Read with `fetch`, the code in a header | Met in `ledger-client.js`; the page uses it from SF-035 |
| SF-034 | One group per stream; closing frees it; reconnects after 1, 2, 4 … 30 s | Met (row 4; R4 and B12 caught) |
| SF-034 | At most one live connection per page | Met (B13 caught) |

## Decision and follow-up state

- **`changes_requested`**, for F-8. The rework is small: one check in `server/api.js`, a test
  and a break check. D-17 (F-9's numbers) is recommended in the same rework.
- STATE changes:
  - T-08: `status` `changes_requested`, `review_receipt`, one `review_outcomes` entry;
  - `next_phase` `implementation`;
  - new open decision D-17;
  - a history line.
  - Cards noted: SF-033 (F-8, F-9, N-4) and SF-038 (N-5).
- Production verification: `not_started`, unchanged. Nothing was committed, pushed or deployed.
  PC-005 still waits for the push. **Don't push T-08 before the rework is accepted.**
- **Afterwards (same day):** the owner answered "ya go as per recommendations" (D-17 (a)), and the
  rework was done in this same conversation on the owner's word. See the rework section of
  [T-08-implementation.md](T-08-implementation.md). This conversation can't review its own
  rework, so the next review must be a fresh conversation.

## Second review: the rework

- **Review context:** a fresh conversation, 2026-09-30, about 18:40–19:30 IST. It wrote none of
  the reviewed code, neither T-08 nor its rework. The rework was done in the first review's
  conversation, so that conversation's own checks don't count as this review.
- **Reviewed input:** verified, **yes**. Nothing had drifted from the receipt.
  - The rework's 10 files, and the 16 files the receipt says are unchanged, all match their
    SHA-256 on disk (`sha256sum -c` over 26 rows). They matched again after every break run.
  - Every server, rules and test file is LF on disk (0 CR bytes).
  - The page's six files equal `HEAD`.
  - The `Caddyfile` deletion is still the only staged change.
  - This review changed no app, server, rules, test or hosting file. It added its own probe and
    output files, and edited only planning files (listed under "Decision and follow-up state").
- **Verdict: `accepted`.**
  - F-8 is fixed, F-9 is done with D-17's numbers, and N-4 is fixed.
  - Every acceptance criterion of SF-031 to SF-034 is now met. The page-side items stay on
    SF-035 (D2, accepted in the first review).
  - D19 to D22 are accepted.
  - One new finding, **F-10 (medium)**: the cost of reading a very large group. Two notes, N-6
    and N-7. None is an unmet criterion.
  - F-10 needs settling **before T-09's switch-over, not before T-08's push**. Until the
    switch-over the family's data stays on Firestore. Installed phones also start from the
    worker's cache, which serves the cached page first (`service-worker.js`, lines 70–81).

### Contract checked and adversarial examples

Expected values were worked out by hand from the cards, `REVIEW.md` and D-17 before running
anything. Rows Q1–Q8 come from this review's probe, [T-08-review2-probe.mjs](T-08-review2-probe.mjs)
([output](T-08-review2-probe-output.json)). It runs the real server in-process on 127.0.0.1, with
temporary databases and raw sockets, and behind the proxy setting, so `X-Real-IP` tells addresses
apart.

| # | Input | Expected (by hand) | Observed |
|---|---|---|---|
| Q1 | **Held bodies against the change limit, at the real 300.** From 10.0.0.1: `PUT` a group (change 1) and add Asha (change 2). Then 400 `POST /api/expenses`, each on its own connection, every head first and the bodies 500 ms later. Then a read from 10.0.0.1, and a change from 10.0.0.2 | 300 − 2 = **298 × 201, then 102 × 429**. The read gets 200 and shows 298 expenses. The other address gets 201 | 298 × 201, 102 × 429; read 200 with 298; other address 201 |
| Q3a | **Does a 429 say a code exists?** With 10.0.0.1 at its change limit: each of `PUT /api/group`, `POST /api/people`, `POST /api/expenses`, `DELETE /api/people/asha` and `DELETE /api/expenses/h0`, once with the known code and once with an unknown one. Then 40 more changes with unknown codes, then a read of each code | All ten get 429, known and unknown alike, with the same body, headers and `Retry-After`. The 40 get 429 and are never looked up, so they don't count as guesses: the known read then gets 200, the unknown 404 | Exactly: 5 pairs of 429, the same body and the same headers (all but `Date`), `Retry-After` 599 for both; 40 × 429; then 200 and 404 |
| Q3b | **Does a 503 say a code exists?** 10.0.0.3 holds 10 streams on a known group; then an 11th on the known code and one on an unknown code. The same two from 10.0.0.4, which holds none | At the cap: known 503 `unavailable`, unknown 404, which counts as a guess. Below the cap: known 200, unknown 404. So a 503 comes only where a 200 would have, and says no more than the 200 | 10 × 200; at the cap 503 `{"error":"unavailable"}` and 404; below it 200 and 404 |
| Q4 | **A replay into a full group, at the real 5,000.** A group, 100 people with 64-character IDs, 5,000 of the largest expenses (from rotating addresses, each under 300 changes). Then delete `f0`; add a new `f5000`; send `f1` again; send the deleted `f0` again; send `f2` again with a payer who isn't in the group | Fill: 5,000 × 201. The version after the delete: 1 + 100 + 5,000 + 1 = **5,102**. The new one: 409 `failed-precondition`, `group-full` (deleted ones count). All three replays: 200 at version 5,102, with nothing changed (they exist, so the payer isn't checked). Rows: 5,000, 1 deleted | Exactly. The fill took 14 s; the database was 67.9 MB, about **13.6 KB per expense** |
| Q5 | **`isDate` against an independent calendar.** 90,552 strings in the page's format: the years 1900, 2000, 2023, 2024, 2026, 2100 and 9999; months 00–13; days 00–32; seven times, including `24:00:00`, `12:60:00` and `12:00:60`; four kinds of fraction | Valid exactly when the month is 1–12, the day exists in that month (29 February only in leap years: not 1900 or 2100, but 2000), the hour ≤ 23, the minute ≤ 59 and the second ≤ 59 | **0 mismatches** in 90,552 |
| Q6 | **Log lines.** Every line from every probe server, against the codes, the `X-Real-IP` addresses and the typed text used | Only `SplitFamilia api: <method> <status> <code>`, or one of the two "an address reached the limit" lines. No code, address or typed text | 6 lines, 4 distinct (`… limit of changes`, `GET 404 not-found`, `GET 503 unavailable`, `POST 409 failed-precondition`); **none bad** |
| Q8 | **Reading the full group from Q4** (4,999 expenses shown). One read, timed. Then 10 reads, each on its own connection, whose answers are never read; meanwhile, a request for the page `/` | No card sets a read limit, so this row measures, as P8 did for writes. Estimated by hand: about 7.5 KB per expense in JSON, so about 37 MB per read | **37.3 MB and 1.74 s per read**, not gzipped even when asked. While the ten were being built, **`/` took 16.7 s**. The process's memory grew from 493 MB to 1,102 MB while they were held (F-10) |
| Q9 | Can a client dodge the per-address limits with many IPv6 addresses? (`Resolve-DnsName … -Type AAAA` with the default resolver, 8.8.8.8 and 1.1.1.1) | Only if Railway serves this host over IPv6 | **No AAAA record** from any of the three, and one A record. Clients reach the edge over IPv4 only, so one address is one IPv4 address (N-6) |
| P1, P8, P9 | The first review's probe, re-run unchanged | P1: 30 × 404 and 30 × 429; 30 groups from 60 held `PUT`s. P8: 1 + 100 + 199 = 300 changes, then 1,801 × 429. P9: one address holds 10, then gets 503 | Exactly: P1 30 and 30, with 30 groups; P8 199 × 201 and 1,801 × 429; P9 10 × 200 and 10 × 503. P2–P7 as in the first review |

### Findings

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-10 | **Medium.** No card sets this; an inference about abuse, measured. The same kind as F-9 | `server/api.js` 237 (`readGroup` on every `GET`, with no limit for a known code); `server/db.js` 152–171; `sendJson` (the whole answer built at once, never gzipped) | **Trigger:** anyone makes a group of their own and fills it: 100 people with 64-character IDs, then 5,000 of the largest expenses, each split among all 100. From one address that takes about 2 h 50 min at 300 changes per 10 minutes; from 18 addresses, the 14 s of Q4. Then they read it again and again. **Observed (Q8):** each read is 37.3 MB and holds the server for 1.74 s. With ten reads in flight, the page's own `/` waited 16.7 s, and memory grew by about 600 MB while the answers were held unread | Once the API is public, a few reads a second from one address keep the single Node process busy. From T-09 that stops the family's page, sync and live updates, and memory spikes may restart the service. Before T-09 the effect is small: installed phones start from the worker's cache, and the data is on Firestore. No data can be read or changed this way. D-17's expense cap is what bounds a read at 37 MB; before the rework it had no bound | **D-18 (new, open), for the owner. Fix before T-09's switch-over** (SF-038's card). Recommended (a): bound what one read can cost. Cap a group's split entries at 20,000 in all, deleted ones included (for example 100 people × 200 expenses, or 10 × 2,000), so the largest read is about 5 MB. Gzip the API's answers when asked; the IDs repeat, so the gain is large. Build one answer per group version, shared by every reader. Then measure again, as in Q8. (b): accept the risk and watch Railway's metrics |
| N-6 | Note | `server/api.js` lines 7–8 (a comment); D-17 | The change limit sets a rate, not a total. At 13.6 KB per largest expense (Q4), one address at the limit can add 43,200 a day, about **590 MB a day**. That fills the Pro plan's 50 GB volume (Railway's docs, checked 2026-09-30) in about 85 days, and ten addresses fill it in about 9. So the comment "so no one can fill the database" overstates it. The limit holds today because clients reach Railway over IPv4 only (Q9); over IPv6, one client could use many addresses | Cost and, in time, a full volume. No data is exposed | → SF-038's card. At the next edit of `server/api.js`, say "quickly" in the comment. `HOSTING_RAILWAY.md` gains a **MANUAL ACTION REQUIRED** step: check the volume's usage monthly. Railway's docs don't mention usage alerts (**VERIFY IN RAILWAY**). If the host ever serves IPv6, count an IPv6 address by its /64 |
| N-7 | Note | SF-037's card | The dry run lists groups over "the owner's limits since 2026-09-30" (100 people, a split of 100), but not the new 5,000 expenses per group (D-17) | If the import endpoint applies the cap, an import into a group over it would stop at 5,000 and the rest would be missing. The family's groups are expected to be far below it | → SF-037's card (noted by this review): the dry run also lists groups with more than 5,000 expenses, deleted ones included |

The decisions the rework asked about:
- **D19 (changes are counted after the body checks; unknown codes count as changes and as
  guesses; the change limit is checked before the lookup): accepted.** Q3a shows the 429 is the
  same for known and unknown codes.
- **D20 (one sliding-window counter for both limits): accepted.** Each limit's tests catch its
  own break (B9, B16).
- **D21 (the shared test servers raise the limits; each limit is tested on a server of its
  own): accepted.**
  - The stream cap is tested at its real 10.
  - `WRITE_LIMIT` and `MAX_EXPENSES` are asserted to be 300 and 5,000, and tested at 6 and 3.
  - Q1 and Q4 add runs at the real 300 and 5,000.
- **D22 (the page is unchanged, with no cache bump): accepted.** The page doesn't load
  `ledger-rules.js` until SF-035.

Traced by hand in the code:
- `server/api.js` lines 224–234 have no `await` between the checks and the counts:
  `groupVersion` and every ledger call are synchronous `node:sqlite`. So no request can get
  between a check and its count, for the guess limit and the change limit alike.
- `hub.full` and `hub.open` run in the same synchronous turn. The per-address count is freed in
  `remove`, on the response's `close`.

### Commands and results

All on this machine: Node 24.21.0, 2026-09-30 (IST).

| Check | Command | Result |
|---|---|---|
| Input hashes | `sha256sum -c` over 26 rows (the rework's table, plus the 16 unchanged files with the first table's hashes); `git diff --quiet HEAD -- <each page file>`; the CR bytes in each file | All OK, before and after each break run. The 6 page files equal `HEAD`. 0 CR bytes |
| Full suite | `npm test` | **140/140** pass |
| The implementer's break checks | `node docs/planning/evidence/T-08-break-checks.mjs` ([output](T-08-review2-runs-output.txt)) | **20/20 caught**, including B15–B20. Every file restored byte for byte |
| The first reviewer's break checks | `node docs/planning/evidence/T-08-review-breaks.mjs` (the same output file) | **8/8 caught**. Every file restored |
| The first review's probe | `node docs/planning/evidence/T-08-review-probe.mjs` | As in the table's last row |
| This review's probe | `node --expose-gc docs/planning/evidence/T-08-review2-probe.mjs` | Rows Q1–Q8, about 38 s. The first run stopped at once: Windows refused some of 400 connections opened all at once ("no answer") before any request reached the server. The probe now opens them one by one, and each body is still held |
| DNS | `Resolve-DnsName splitfamilia.up.railway.app -Type AAAA` (the default resolver, `-Server 8.8.8.8` and `-Server 1.1.1.1`) | No AAAA record; A only |
| Image check | `node docs/planning/evidence/T-08-image-check.mjs <empty scratch dir>` | The same as before: 17 files; the 9 page URLs byte-identical with all headers; 8 other paths 404; `storage: volume`; versions 1–4; the database on the stand-in volume; no code in the log |
| Browser check | `node docs/planning/evidence/T-08-browser-check.mjs <repo> <empty scratch dir>` (headless Edge) | The same as before: the worker in control; `splitsheet-v5` with 9 entries; four 304s; an offline start with the server stopped; 0 errors; 0 Firestore requests |

Not run: `npm run test:rules`, because `firestore.rules` and its tests are unchanged (hashes
checked; 15/15 in the first review). Still not exercised: a Docker build, SIGTERM, and Railway's
live edge (`X-Real-IP`, held bodies, the stream through the proxy). → PC-005 and SF-035.

### Acceptance checklist: the changed rows

| Story | Criterion | Verdict |
|---|---|---|
| SF-033 | **More than 30 unknown codes from one address in 10 minutes gives 429**; 16 KB; JSON only | **Met now**, with bodies held too (the new test, B15, P1, and Q1's shape) |
| SF-033 | Split 1–100, at most 100 people, the ID pattern and the other limits, now with D-17's 5,000 expenses per group | Met (Q4; B17) |
| SF-033 | D-17: 300 changes per address per 10 minutes, then 429, while reads still work | Met (Q1, Q3a; B16) |
| SF-034 | D-17: 10 streams per address, then 503; closing one frees a place | Met (the new test, Q3b, P9; B18, B19) |
| SF-033 | N-4: dates that roll over are refused | Met (Q5; B20) |

Every other row of the first checklist stands.

### Decision and follow-up state

- **`accepted`:** T-08 is `done`, with a `review_outcomes` entry for this review.
- **New open decision D-18** (F-10), needed by SF-038, so before T-09's switch-over. It is not
  the implementation receipt's own D18.
- Cards noted: SF-038 (F-10, N-6) and SF-037 (N-7).
- Files this review wrote or edited:
  - new: `T-08-review2-probe.mjs`, `T-08-review2-probe-output.json` and
    `T-08-review2-runs-output.txt`;
  - edited: this receipt, `STATE.json`, `HANDOFF.md`, and the SF-037 and SF-038 cards.
- Production verification: `not_started`, unchanged. Nothing was committed, pushed or deployed.
  - Pushing T-08 now needs only the owner's word (D-5). PC-005 follows the push.
  - The page is unchanged, so phones see no difference.
