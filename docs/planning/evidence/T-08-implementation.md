# T-08 implementation receipt — Railway backend: a small Node server, the SQLite database, the ledger API and live updates

- **Task:** T-08. Stories, in order: [SF-031](../stories/SF-031.md), [SF-032](../stories/SF-032.md),
  [SF-033](../stories/SF-033.md), [SF-034](../stories/SF-034.md).
- **Phase:** implementation, 2026-09-30, about 11:15–12:20 IST. The self-check here is **not**
  the fresh-session review.
- **Baseline:** `fa17597` (pushed; `main` up to date with `origin/main`). The working tree
  already held the previous sessions' uncommitted planning files: the T-03 review receipt and
  probe, STATE, HANDOFF, and the cards SF-016 to SF-038. This session left them alone apart from
  the edits listed under Documentation.
- **Decisions taken by default:** the owner said "continue" without answering D-13 to D-16, so
  each takes its recommended option, as HANDOFF said (STATE `open_decisions`). D-13 (SQLite on a
  Railway volume) is the one T-08 needs.
- **Review input:** the SHA-256s below are of the files as on disk. Every one is LF on disk, as in
  git (`git ls-files --eol`), so `sha256sum <file>` gives the same value. The page's own files
  (`index.html`, `money.js`, `group-code.js`, `sync-status.js`, `service-worker.js`,
  `manifest.json`) are unchanged from `HEAD` (`git diff --quiet HEAD -- <file>`).

| File | SHA-256 |
|---|---|
| `ledger-rules.js` (new) | `4684277b6d92d8c5503621774dd42cbfe21915c871d46955a41e30e3ccb97394` |
| `ledger-client.js` (new) | `f1f8cde80d06345126494cbd9c71d76152c2b569294143cd9590ff0265635447` |
| `server/main.js` (new) | `0273ea59c8c1990cbe08b969465a137c0272f0447638d785edebe8b2b5ac6240` |
| `server/server.js` (new) | `370cd1a9553e7a4f0eb987d5a762b3f99c86dfe1037cb63bd15f0bdc9622ea4d` |
| `server/static.js` (new) | `2c3da9e7473d6948d3350119270dc53ae0879ce6e9fdd381066a0c84466e18a2` |
| `server/db.js` (new) | `c0f27172d9e99a98e1f7c1375f25d884c774f3ce2149053bb02934228028b6fd` |
| `server/api.js` (new) | `32be50ba096226eca08f198b887124e0bb7e2bd68c7dd5ebcc2b00bf4381dbe7` |
| `server/live.js` (new) | `d0815610fdcfcb378497a56edef4582b3ce3e6388ce468b6155ed5091816f8e7` |
| `Dockerfile` | `43f72d7c22dfbc45c8a16c2a7d94355077a714c8a8bbacd7d8c158851a47d135` |
| `.dockerignore` | `37df387b84e4d4c5898027a2e596d480dc3096e8ce6222b89461590b60adb9c1` |
| `railway.json` | `33fcc28df222e7714dcf48f8c9a412f0662c002f8f5feb04f8f3570186afd7a7` |
| `package.json` | `a05b5a65d1d8760d08f143196d02d3afe3daadc869bd70ec96a3c7447948bee8` |
| `.gitignore` | `0d169fb53520c47dad4b95475731db245f1abc6f1f35d055372d75ff3ed995f3` |
| `tests/wiring.test.js` | `ca7eec989d27dfa23478b00add43341cb0b5e4d7ccb61003638ba6de17f1203d` |
| `tests/helpers/test-server.js` (new) | `da00e11fd0df92cf77f90ff0dafcf7bfc5be4950f4e66a9da614767affe5aef8` |
| `tests/ledger-rules.test.js` (new) | `860b306dd8b7de39807d603c70012c508fa291ec45adbaa1c2e79075e731287a` |
| `tests/server-static.test.js` (new) | `ef9f43fd6807d76205179d3a405c8bef8de62990d0b68be814498eb29b4ed26d` |
| `tests/server-db.test.js` (new) | `d41f9c69dc55f74fd24f808f8a5ac76e7a86ea638b188e61ae21f942844683c5` |
| `tests/server-api.test.js` (new) | `7784058b4bc8196d03544d478ccc22ef160ee7dcfa3686e2f8ee58e77763bc76` |
| `tests/server-live.test.js` (new) | `065265c794ad30717c0517215fac1e68b29496c17d5172311da61e450273a290` |
| `firestore.rules` (D18) | `1cac56a12320d91a62915d78694d4a5750a772c119eab46701e6c72f1e4597a8` |
| `tests/rules/firestore-rules.test.js` (D18) | `3b35ec2a284974f7804714910ea8025f2814d5c1be9a1f7a830fa0bf5337a28b` |
| `evidence/T-08-break-checks.mjs` (new) | `73f180ce494f85c779309728c390de0dc744776da3832de4dcb335c692f9a4c8` |
| `evidence/T-08-image-check.mjs` (new) | `dfeee572517525703587c595b9e2876adac7603edc50a24b720a43db0d689ee8` |
| `evidence/T-08-browser-check.mjs` (new) | `0b1e448afe36d228e4f8536e42d4452b508c5509ab950bbe46881c8a06187b9d` |
| `Caddyfile` | deleted (`git rm`, so the deletion is staged) |

## What it does, in one example per story

- **SF-031:** `https://<host>/` still shows the SplitFamilia start screen with the same headers,
  but now a Node server sends it, not Caddy. `/package.json`, `/server/main.js`, `/%2e%2e/` and
  `/.git/config` all give 404, and `/healthz` gives `{"status":"ok","database":"ok","storage":"volume"}`.
- **SF-032:** ₹33.34 is stored as the integer `3334` and read back as `3334`. After the server
  restarts, the group, its people and its expenses are all still there. Sending Asha's "Taxi"
  again adds nothing, even after Ben deleted it.
- **SF-033:** `GET /api/group` with the header `X-Group-Code: goa-trip-2026` returns the group.
  An expense of `"lots"` paise gets `400 {"error":"invalid-argument","field":"amountPaise"}`.
  A trek of 100 splits one expense fine. A split among 101, and the 101st person in a group,
  are refused (the owner's limits), and so is `Goa-Trip` as a code, on every method. The 31st
  unknown code from one address in 10 minutes gets 429. There is no way to ask for "all groups".
- **SF-034:** Asha adds "Taxi ₹50"; Ben's page, watching the same group through
  `ledger-client.js`, hears version 3 within 1 s (the test asserts under 1000 ms). A page on
  another group hears nothing.

## Per-story status

| Story | Done? | Acceptance criteria met | Notes |
|---|---|---|---|
| SF-031 | Yes | All, with `node:24.21.0-alpine` as the pinned form of `node:24-alpine` (D13) | The image itself wasn't built (no Docker); the staged check covers it (L1) |
| SF-032 | Yes | All. The split is a table, `expense_split` (D4) | The owner's volume, backups and region steps are in HOSTING_RAILWAY.md 3a |
| SF-033 | Yes, except two page-side items moved to SF-035 | All server-side criteria. The page loading `ledger-rules.js` with `?v=N`, refusing a split over the limit before sending, and new `friendlyError` text wait for SF-035 (D2). At most 100 people in a group and 100 in a split, on the owner's word (D18) | The plan contradicted itself here; D2 explains |
| SF-034 | Yes, except that the page doesn't use it yet | All: the stream, the heartbeat, one group per stream, freeing on close. `ledger-client.js` reads with `fetch`, keeps one connection per page and reconnects after 1, 2, 4 … 30 s | The page uses `ledger-client.js` from SF-035 (D2) |

## Changes

| File | What changed |
|---|---|
| `server/main.js` | New. Starts the server on `$PORT` (8080); the database is at `RAILWAY_VOLUME_MOUNT_PATH` or `data/`; warns when on Railway without a volume; stops cleanly on SIGTERM. |
| `server/server.js` | New. `createApp()`: routes to `/healthz`, `/api/…` or the static files, and refuses dot segments in any spelling. Sets `keepAliveTimeout` to 65 s. On close, ends the streams and closes every connection once no request is running. |
| `server/static.js` | New. A fixed list of 10 files (the worker's SHELL, plus the worker, the iPhone icon and `assetlinks.json`), read once at start. Sends the Caddyfile's headers, a SHA-256 ETag with 304, and gzip; everything else is a 404 with the same headers. |
| `server/db.js` | New. `node:sqlite`, WAL, foreign keys and numbered migrations (`schema_version`). STRICT tables with `amount_paise INTEGER`. `ON CONFLICT DO NOTHING` for repeated IDs; deletes set `deleted_at`. Only prepared statements. |
| `server/api.js` | New. The six endpoints and the stream route. The code comes from `X-Group-Code`. Checks come from `ledger-rules.js` and `group-code.js`. Limits: 16 KB bodies, JSON only, at most 100 people per group, 30 unknown codes per address per 10 minutes. Log lines hold only a method, a status and a code. |
| `server/live.js` | New. The event-stream hub: the version at once and after each change, a 25 s heartbeat, at most 1000 streams, `Connection: close`. |
| `ledger-rules.js` | New, no imports. The limits (at most 100 people and 100 in a split, D18) and `checkGroup`, `checkPerson`, `checkExpense`, `isValidId`. |
| `firestore.rules`, `tests/rules/firestore-rules.test.js` | The split limit goes from 50 to 100 to match (D18); the rules tests now try 100 (allowed) and 101 (denied). Firestore rules can't count a group's people, so the people cap is on the server only. The file is not published: that is still the owner's step (D-15). |
| `ledger-client.js` | New. `watchGroup()` (fetch streaming, one per page, reconnect delays, a 60 s idle watchdog, a final stop on 400 or 404), `createEventParser()`, `reconnectDelay()`. |
| `Dockerfile` | From `node:24.21.0-alpine`, `/app` mirrors the repo, `package.json` holds `{ "type": "module" }`, CMD `node server/main.js`; runs as root (D12). |
| `.dockerignore` | Lets in `ledger-rules.js` and the six server files; the Caddyfile is gone. |
| `railway.json` | Health check `/healthz`; watch `/server/**`; no Caddyfile. |
| `Caddyfile` | Deleted. |
| `package.json` | `npm start`. |
| `.gitignore` | `/data/`. |
| `tests/wiring.test.js` | Docker parsing for `/app`. The served list matches the worker's SHELL. The image ships every served, server and imported file. Node on Alpine, `/healthz`, no Caddy, server imports only `node:` or relative. `maxlength`s match `ledger-rules.js`. `ledger-client.js` is held to HTTPS-only. |
| `tests/helpers/test-server.js`, `tests/ledger-rules.test.js`, `tests/server-{static,db,api,live}.test.js` | New: 59 tests. |

## Decisions for the reviewer

- **D1, the layout:** the server is in `server/`, and the image's `/app` mirrors the repo, so
  `server/api.js`'s `import "../money.js"` works the same in both. The page's modules are ES
  modules without a `package.json` in the image, so the Dockerfile writes
  `{ "type": "module" }` there instead of copying the repo's (which holds dev tooling). The
  server never serves it (fixed list).
- **D2, the page stays unchanged in T-08 (the plan contradicted itself):**
  - T-08's STATE note, HANDOFF and SF-031 say the page doesn't change, so T-08 can deploy alone
    with no cache bump.
  - SF-033's card also asks for page-side changes: load `ledger-rules.js` with `?v=N`, and
    "the page refuses more than 50 before sending" (F-6).
  - Doing both in T-08 would change the page, bump the cache to v6 and need a browser UI check,
    for a split no family reaches. So the page is unchanged, and those items are written on
    SF-035's card, where the page is rewritten anyway.
  - The server already refuses a split over the limit (101 since D18). The owner can overrule
    this.
- **D3, `ledger-rules.js` has no imports.**
  - In the browser, a module that imports `./money.js` would load a second, unversioned copy the
    worker doesn't keep. So `ledger-rules.js` repeats `MAX_AMOUNT_PAISE`, and a test checks it
    equals `money.js`'s, as the Firestore rules did.
  - Group codes stay in `group-code.js`, already shared by the page and the server.
- **D4, the split is a table,** `expense_split(group_code, expense_id, position, person_id)`.
  "Is Ben in any expense?" is then one indexed query, and the order is kept (`["c","a","b"]` comes
  back as `["c","a","b"]`). Payers and split members have no foreign key to `people`: someone
  removed while another phone added an expense keeps their share under the old ID, as
  `money.js` already allows.
- **D5, a delete only marks the row (`deleted_at`).**
  - Why: SF-032 says writing the same ID twice is harmless. With a real delete, this would fail:
    phone A's add of "Tea" is confirmed but the answer is lost; Ben deletes "Tea"; A sends it
    again, and "Tea" is back. With the mark, A's second send gets 200 and changes nothing
    (tested, and break check B5).
  - Cost: deleted text stays in the database (and its backups) until the group is deleted.
    Noted on SF-017 (privacy policy) and SF-024 (delete a group).
- **D6, some checks are stricter than the Firestore rules.**
  - Names, descriptions and currency can't be blank or hold a broken surrogate pair.
  - A date must be an ISO time, as `toISOString()` writes it; the rules took any 1–40
    characters.
  - Each split member may be named once, IDs must be 1–64 letters, digits, `_` or `-`, and each
    body must hold exactly the expected fields.
  - The page only ever sends such values. SF-037's import brings old data through its own path.
- **D7, the guessing limit:**
  - After 30 unknown codes from one address in 10 minutes, every API request from that address
    gets 429, known codes too, until the oldest drops out of the window.
  - If only unknown codes got 429, then "429 or 200" would tell a guesser which codes exist.
  - Creating a group counts as an unknown code. Otherwise `PUT` a guess, then `GET` it, would be
    an unlimited way to test codes.
  - Cost: someone on the same Wi-Fi as a guesser may wait up to 10 minutes. The family's own use
    makes almost no unknown requests.
  - The address is `X-Real-IP` behind Railway, which Railway's "Specs & Limits" page says its
    edge sets (checked 2026-09-30), and the connection's own address anywhere else. A test shows a
    made-up `X-Real-IP` gains nothing when not behind Railway.
- **D8, the statuses:**
  - an add answers 201 when new and 200 when the ID is already there;
  - `PUT /api/group` answers 200 whether it created the group or changed it;
  - a delete of something already gone, or never there, answers 200 (harmless, SF-036);
  - a bad code answers 400 `invalid-argument` with `field: "code"`;
  - an unknown group answers 404 `not-found`;
  - a person used in an expense answers 409 `failed-precondition` (`field: "in-use"`), and a
    101st person in a group answers the same with `field: "group-full"`;
  - an unknown API path answers 404, and a wrong method 405;
  - bodies over 16 KB answer 413, and bodies not sent as JSON 415, both closing the connection;
  - an unexpected error answers 500 `internal`, which the page will show as "Something went
    wrong".
- **D9, logging:** only refusals and failures are logged, as `SplitFamilia api: POST 400
  invalid-argument`. 429s aren't logged one by one; one line says "an address reached the limit
  of unknown group codes". A 500 logs the error's code or name, never its message. A test checks
  every log line against a strict pattern and against every code and typed word used.
- **D10, the files:** the fixed list is read once at start. A missing file stops the server from
  starting, so Railway's health check fails and the last good deploy stays live (tested).
  ETags are SHA-256 based. Text files are gzipped when the browser asks, with `Vary:
  Accept-Encoding`: `index.html`'s 42,805 bytes go out as 11,394 (measured on disk, CRLF form).
- **D11, dot segments:** any `.` or `..` segment, in any spelling (`/%2e%2e/`, `/.%2E/`,
  `/x/../index.html`), gives 404. That holds even where tidying the path would give a real file
  (`/%2e%2e/` → `/`), because SF-031 lists `/%2e%2e/` as a 404.
- **D12, root in the container:** Railway mounts volumes as root. Its volume guide says a
  non-root image needs `RAILWAY_RUN_UID=0` (checked 2026-09-30). StockAgent also runs as root.
- **D13, `node:24.21.0-alpine`:** it is the same Node as this machine (24.21.0), pinned the way
  Caddy was. The tag was confirmed on Docker Hub on 2026-09-30.
- **D14, `/healthz` is always 200 while the server runs,** and says whether the database opened.
  A database problem then doesn't take down the page, which doesn't need the database until
  T-09. Worth revisiting at T-09's switch-over, when the API matters.
- **D15, `keepAliveTimeout` 65 s:** Railway's edge closes idle connections after 60 s ("Specs &
  Limits"). The server must hold them longer, or it could close one just as the edge reuses it.
- **D16, stream limits:** at most 1000 streams at once (then 503). One heartbeat timer for all,
  running only while a stream is open (tested). Railway keeps a response open up to 15 minutes
  while data flows, so the 25 s heartbeat keeps it; after 15 minutes the page reconnects after
  1 s.
- **D17, the client stops for good on 400 or 404** (a bad or unknown code won't fix itself), and
  tries again on anything else. After 60 s with no data, not even a heartbeat, it drops the
  connection and reconnects (for example after a phone changes networks).
- **D18, at most 100 people in a group and 100 in a split, on the owner's word (2026-09-30, the
  same chat).** The owner said "a trip can have 100 people, like a group trek". The split limit
  was 50, from the Firestore rules, and there was no cap on people.
  - The owner first asked for a split of about 1000. That was built, with 128 KB requests, then
    replaced by the owner's final numbers of 100 and 100. Requests are back at 16 KB.
  - The caps are guards, not something a family meets: anyone with a code can call the API
    directly. Without them, a group could be filled with thousands of people, and an expense
    split among them.
  - The largest allowed expense (100 people with 64-character IDs, a 200-character Devanagari
    description) is about 8 KB, so 16 KB holds it with room; a test sends exactly that expense.
  - A 101st person gets 409 `failed-precondition` with `field: "group-full"`. People marked
    deleted don't count, so after someone is removed there is room again. Sending someone
    already there again still succeeds, full or not, so a replay is never refused.
  - `firestore.rules` says 100 for the split too, so the page and a published stopgap agree, and
    `npm test` checks that they match. The file changed only in the repo. Firestore rules can't
    count a group's people, so that cap is on the server only.
  - Updated to say 100: the SF-033, SF-028, SF-035 and SF-037 cards, `FIRESTORE_RULES.md`,
    `REVIEW.md` and HANDOFF.

## Tests

All run on this machine, Node 24.21.0, 2026-09-30 (IST).

| Check | Command | Result |
|---|---|---|
| Baseline, before any change | `npm test` | 72/72 |
| Full suite | `npm test` | **136/136** (72 before + 61 in the new files + 3 new wiring checks), about 3–6 s; run several times in a row, same result |
| New files alone | `node --test tests/ledger-rules.test.js tests/server-static.test.js tests/server-db.test.js tests/server-api.test.js tests/server-live.test.js` | 59/59 before D18; D18 added two (the largest expense, the people cap), so 61 |
| Firestore rules, after D18's edits | `npm run test:rules` (Java 21 on `PATH`) | **15/15** on the emulator, with a split of 100 allowed and 101 denied (final run). With the interim limit of 1000, the first run right after the rules edit exited 255; its summary wasn't captured (the filtered output showed only the expected PERMISSION_DENIED lines). That matches the known watcher quirk after a rules edit (T-03's L13), and the next run passed 15/15. No emulator was left running, and `firestore-debug.log` was deleted |
| Break checks | `node docs/planning/evidence/T-08-break-checks.mjs` ([output](T-08-break-checks-output.txt)) | 14/14 caught (B14 added with D18); each file restored byte for byte (SHA-256 checked by the script, and again with `Get-FileHash` on the first runs) |
| Image check | `node docs/planning/evidence/T-08-image-check.mjs <empty scratch dir>` ([output](T-08-image-check-output.txt)) | Staged exactly the Dockerfile's 17 files plus its `package.json`, started `node server/main.js` with Railway-like variables and a stand-in volume. The 9 page URLs came back byte-identical to the repo with all headers. 8 other paths gave 404, including `/server/main.js`, `/ledger-rules.js` and `/splitfamilia.db`. `/healthz` said `storage: volume`. PUT, POST, POST, POST and GET gave versions 1–4. The database was on the volume, not in `/app`. The log held no group code. No `node:sqlite` warning. |
| Browser check | `node docs/planning/evidence/T-08-browser-check.mjs <repo> <empty scratch dir>` ([output](T-08-browser-check-output.json)) | Headless Edge, the real page from the Node server. The first visit showed the start screen, the worker took control and cached 7 app files and 2 SDK files (`splitsheet-v5`). The second visit got four 304s. With the server stopped and the browser offline, the app still started from the cache. 0 errors, 0 Firestore requests. Run before D18; the files it exercises (`server/server.js`, `server/static.js`, the page) haven't changed since. The image check was re-run after D18. |

The break checks, and the test that catches each:

| # | Story | Break | Caught by |
|---|---|---|---|
| B1 | SF-031 | drop `nosniff` | 6 static tests |
| B2 | SF-031 | serve `package.json` too | the 404 list, and 2 wiring tests |
| B3 | SF-031 | leave `server/live.js` out of the image | the wiring image test |
| B4 | SF-032 | one query built by string concatenation (the card's break check) | the `'` and `;` test |
| B5 | SF-032 | a real delete instead of a mark | 2 replay tests |
| B6 | SF-033 | skip the code check on DELETE (the card's F-7 break check) | the F-7 test |
| B7 | SF-033 | allow a split of 101 | tests across 3 files (see the output) |
| B14 | SF-033 | no cap on people per group | the 100-people test |
| B8 | SF-033 | allow deleting a person used in an expense | the 409 test |
| B9 | SF-033 | allow one more unknown code | 2 limit tests |
| B10 | SF-033 | put the group code in a log line | the log test |
| B11 | SF-034 | don't publish a change | the two-phones test |
| B12 | SF-034 | cap the reconnect delay at 60 s | the delay test |
| B13 | SF-034 | keep the old watch when a new one starts | the one-per-page test |

The first run of B13 hung: the kept watch went on reconnecting after its test failed, so the test
process never ended. The session stopped only those two test processes; the script then restored
`ledger-client.js` (hash checked). Since then, the test stops every watch in `finally`, and the
script gives each run a time limit. The final run above completed normally.

Found and fixed during the self-check:
- `/%2e%2e/` served the page (see D11).
- A limiter test sent codes with dots, so they were refused as invalid before counting (fixed
  in the test).
- SQLite's STRICT tables accept the text `"3334"` as the integer 3334 (documented SQLite
  behaviour; the API refuses any string first). The test now uses text that isn't a number.
- Two live tests took about 3 s each. A supposed half-open-socket leak was checked and ruled
  out: tracing the server's socket events showed Node closes the connection when the page does.
  The real cause was a spare connection the test's `fetch` opens and never sends a request on,
  which kept shutdown waiting 3 s. Shutdown now closes every connection once no request is
  running, and it takes about 8 ms.

Not exercised:
- building the Docker image (no Docker here; L1);
- SIGTERM from Railway (Windows can't send it; `app.close()` itself is tested);
- `X-Real-IP` on the live edge (L3);
- the live-update stream through Railway's proxy (L7).

## Documentation

- `docs/google-play/HOSTING_RAILWAY.md`: section 1 describes the Node server; section 3 step 5
  now looks for the new log line and `/healthz`. New **section 3a**: the region, the volume at
  `/data` and backups (**MANUAL ACTION REQUIRED**, **VERIFY IN RAILWAY**), what
  `/healthz` shows, and the few seconds of downtime per deploy. Section 4 adds the after-push
  check (PC-005); section 8 covers rolling back to the Caddy deployment.
- `README.md`: the repo map (`server/`, `ledger-rules.js`, `ledger-client.js`, `data/`; no
  Caddyfile), `npm start`, the tests table and deploying.
- `CLAUDE.md`: the Server entry, the hosting files, "Run it", the tests and the Railway host.
- `docs/planning/REVIEW.md`: invariants for the server's API and for "only the app is served";
  "only the app is shipped" now includes the server.
- `docs/google-play/PRODUCTION_AUDIT.md`: a T-08 note on the rows it changes (own API, CORS,
  environment variables, the database) for SF-021.
- Story cards: SF-035 (the page-side items from D2, what the page will call, and the `?g=` note),
  SF-036 (how the server treats a change sent again), SF-017 (deleted entries stay in the
  database), SF-024 (deleting a group must remove the marked rows too).

## Open limitations and follow-ups

- **L1:** the Docker image itself was not built (no Docker). The staged check runs exactly its
  files and CMD. Railway's next build is the first real one; if it fails, the health check keeps
  the old Caddy deployment live. → PC-005.
- **L2:** the rate limit's memory resets on every restart and deploy. It's fine with one
  instance, which a volume requires anyway.
- **L3:** `X-Real-IP` comes from Railway's docs, not from watching it live. Railway's community
  pages say it is wrong when Railway's CDN is on; this service doesn't use it. If it were
  missing, every visitor would share the proxy's address, and one guesser could make everyone
  wait up to 10 minutes. → worth a look at PC-005 (the deploy log shows no address; a reviewer
  can check with a one-off log line in a scratch deployment, on the owner's word).
- **L4:** an invite link's `?g=<code>` still reaches the server in the page's own URL (the first
  open, and the worker fetching the page), and Railway's request log may record it. It was the
  same with Caddy. → SF-035 card (options; **OWNER CONFIRMATION REQUIRED** before changing the
  link format).
- **L5:** deleted entries stay in the database and its backups until the group is deleted (D5).
  → SF-017, SF-024.
- **L6:** the page uses none of this yet. The browser's `fetch` streaming through Railway's proxy
  (15-minute limit, 25 s heartbeat) was tested only in Node against a local server. → SF-035's
  browser check.
- **L7:** backups, the region and the volume are the owner's steps (HOSTING_RAILWAY.md 3a), and
  the backup options are **VERIFY IN RAILWAY**.
- **L8:** `/healthz` is public and says whether the database opened and whether a volume is
  attached. Nothing else.

## Rework after the fresh review (2026-09-30, about 17:55–18:15 IST)

The fresh review ([T-08-review.md](T-08-review.md)) gave `changes_requested` for **F-8**. It
also raised **F-9** with a new decision, **D-17**, and noted **N-4**. The owner answered: "ya go
as per recommendations". That is D-17's option (a), and the rework was done on the owner's word
**in the same conversation as the review** (CLAUDE.md §3 asks for one phase per conversation;
the owner's instruction wins, and STATE `history` records it). So **the next review must be a
fresh conversation**, and this rework's own checks don't count as it.

### What changed, one example each

- **F-8 (the guess limit, `server/api.js`):**
  - Once the body has been read, the handler checks `limiter.blocked(address)` again, just
    before `ledger.groupVersion(code)`. From there on nothing waits, so no other request can
    get between the check and the count.
  - Example: 60 `POST`s with unknown codes, all heads first and the bodies 300 ms later, now
    get 30 × 404 and 30 × 429 (before: 60 × 404). 60 such `PUT`s now create 30 groups (before:
    60).
- **F-9 with D-17 (a):**
  - **At most 300 changes per address in 10 minutes** (`WRITE_LIMIT`, `createWriteLimiter()`
    in `server/api.js`). Every `PUT`, `POST` and `DELETE` that gets past the body checks
    counts, replays and unknown codes included. The 301st gets 429 `resource-exhausted` with
    `Retry-After`. The address can still read. Example: the review's flood (a `PUT`, 100
    people, then 2000 expenses) now gets 199 expenses in and 1801 × 429 (before: all 2000, 28
    MB).
  - **At most 10 live streams per address** (`MAX_STREAMS_PER_ADDRESS` in `server/live.js`;
    `hub.full(address)`). The 11th gets 503 `unavailable`, as when the server is full. Closing
    one frees a place. Example: with 1.1.1.1 holding 10, its 11th gets 503 and 2.2.2.2 still
    gets one.
  - **At most 5,000 expenses per group, deleted ones included** (`MAX_EXPENSES` in
    `ledger-rules.js`; `ledger.expenseCount()` in `server/db.js`). The next add gets 409
    `failed-precondition` with `field: "group-full"`. Sending an expense that's already there
    still gets 200, deleted or not.
- **N-4 (`ledger-rules.js` `isDate`):** the date and time must come back unchanged from
  `new Date(value).toISOString()`. Example: `2026-02-30T00:00:00.000Z` and
  `2026-09-30T24:00:00Z` are now refused; `2024-02-29T12:00:00.000Z` is still allowed.

### Decisions

- **D19, counting changes.** The limit counts after the body checks, so a malformed request
  (400) doesn't use it up. Unknown codes count as changes too, and as guesses. The limit is
  checked before the group is looked up, so a 429 never says whether a code exists.
- **D20, one limiter.** The guess limit and the change limit share one sliding-window counter
  (`createAddressLimiter`), each with its own numbers. B9 (allow one more) breaks both, and the
  tests of both catch it.
- **D21, the test servers.** The shared servers in `server-api.test.js` and
  `server-live.test.js` send hundreds of changes, and open 100 streams, from 127.0.0.1. So they
  set `writeLimit: 100000` and `maxStreamsPerAddress: 1000`. Each new limit has its own test on
  a server of its own:
  - the stream cap is tested at its real 10;
  - the change limit at 6, with a test that `WRITE_LIMIT` is 300;
  - the expense cap at 3, with a test that `MAX_EXPENSES` is 5,000.
- **D22, the page is still unchanged.** `ledger-rules.js` changed, but the page doesn't load it
  until SF-035, so there's no cache bump. SF-035's card now also asks for page text for the
  expense cap.

### Files changed in the rework

These replace the earlier table's rows for the same files. Every file is LF on disk, with no BOM
(checked by counting CR-LF bytes).

| File | SHA-256 |
|---|---|
| `ledger-rules.js` | `a1c727ae64bd727e92d918793765cb1c3aabdb093c941fc345c9a77e4b215422` |
| `server/api.js` | `f04809d5bb70524fd617eb53a1381fa8b84ce9918f853c1a0d39bcebbb91ace1` |
| `server/live.js` | `1f74efbaaac3b20a82f94bc3f571a1fd2f457197e7d098f5921b7726eb431f3f` |
| `server/db.js` | `2de2141cbe74b860c6510f3f9f28cc2e3e3c67e17c46f5c2c8ae8b3d14d071a0` |
| `server/server.js` | `a3f3fef322f7c38ca9f3463460d06f42e48a7b6db652d02c92e2f1be0e03d04e` |
| `tests/ledger-rules.test.js` | `bfd36d1eb482354a3faaa3c8e89400844fe31546314f4e115e3160a977b3098e` |
| `tests/server-api.test.js` | `61d749d330d3b1e89cb34558ad4ea7dac88ed2368507ee3984dea9da74d87d09` |
| `tests/server-live.test.js` | `d975e6a26939e571fd00c58dcc4c7e01856cef3cd214a57817f7b31b08d117d1` |
| `evidence/T-08-break-checks.mjs` (B15–B20 added) | `612eb8386cf8dfed27588885194a12ced91c91018ba597a737b38882eb8c9569` |
| `evidence/T-08-review-breaks.mjs` (R4's text now matches `remove(code, res, address)`) | `10b72983b971051fe30a1f595e102a200beb20c23b9f28be691d43acd9e846bd` |

Unchanged since the review, with the earlier hashes still valid:
- `ledger-client.js`, `server/main.js` and `server/static.js`;
- `Dockerfile`, `.dockerignore`, `railway.json`, `package.json` and `.gitignore`;
- `tests/wiring.test.js`, `tests/helpers/test-server.js`, `tests/server-static.test.js` and
  `tests/server-db.test.js`;
- `firestore.rules` and its tests;
- the image and browser check scripts;
- the page's six files, which still equal `HEAD`.

### Tests and checks (all run in this conversation, Node 24.21.0)

| Check | Command | Result |
|---|---|---|
| Full suite | `npm test` | **140/140** (136 + 4 new tests; 3 existing tests gained assertions) |
| New tests | in `server-api.test.js`: F-8 held bodies and held `PUT`s; the change limit (held bodies too, reads still work, another address, one log line, the window); the expense cap (deleted ones count, replays succeed). In `server-live.test.js`: 10 streams per address. In `ledger-rules.test.js`: `MAX_EXPENSES` 5,000; impossible dates. The 100-streams test also checks that no address is left holding a stream | Pass |
| Break checks | `node docs/planning/evidence/T-08-break-checks.mjs` ([output](T-08-break-checks-output.txt), now LF) | **20/20 caught**. The new ones: B15 (F-8: the second check removed), B16 (no change limit), B17 (no expense cap), B18 (no per-address stream cap), B19 (closed streams still count), B20 (N-4: rolled-over dates). Every file restored byte for byte (the script's SHA-256, then `sha256sum -c`) |
| The reviewer's break checks | `node docs/planning/evidence/T-08-review-breaks.mjs` ([output](T-08-rework-review-breaks-output.txt)) | 8/8 caught |
| The review's probe, unchanged | `node docs/planning/evidence/T-08-review-probe.mjs` ([output](T-08-rework-probe-output.json)) | P1 held bodies: 30 × 404, 30 × 429; held `PUT`s: 30 groups; P8: 199 × 201, 1801 × 429, 2.8 MB. P9: one address holds 10, and the other 10 get 503. The probe's "family" stream shares that address (127.0.0.1), so it gets 503 too; a family on another address is covered by the new live test. P2–P7 are the same as in the review (P4 differs only in its timing) |
| Image check | `node docs/planning/evidence/T-08-image-check.mjs <empty scratch dir>` ([output](T-08-image-check-output.txt), now LF) | The same as before: 17 files; 9 page URLs byte-identical; 8 other paths 404; `storage: volume`; versions 1–4; no code in the log |
| Browser check | `node docs/planning/evidence/T-08-browser-check.mjs <repo> <empty scratch dir>` ([output](T-08-browser-check-output.json)) | The same as before: the worker in control, `splitsheet-v5` with 9 entries, four 304s, an offline start with the server stopped, 0 errors, 0 Firestore requests |

Not run again: `npm run test:rules`, because `firestore.rules` and its tests didn't change (15/15
in the review).

### Documentation

- `REVIEW.md`: the API invariants now include 5,000 expenses per group, the guess limit holding
  for requests with late bodies, and the change and stream limits per address.
- Story cards:
  - SF-033: D-17's answer and a pointer here;
  - SF-035: page text for the expense cap, and 429 on a change means "try again later".

### Open limitations added

- **L9:** the new limits, like the guess limit, are per address (`X-Real-IP` behind Railway; L3)
  and live in memory, so a restart resets them (L2). Behind a shared address (one Wi-Fi, or a
  mobile network that shares one IPv4 address), people share the limits. A family's normal use
  stays far below 300 changes and 10 streams.
