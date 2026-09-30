# T-09 implementation receipt — Move the app and the data to Railway, then remove Firebase

- **Task:** T-09. Stories, in order: [SF-035](../stories/SF-035.md), [SF-036](../stories/SF-036.md),
  [SF-037](../stories/SF-037.md), [SF-038](../stories/SF-038.md).
- **Phase:** implementation, 2026-09-30, about 20:35–22:40 IST.
  - It ran in the same conversation that reviewed T-08's rework, on the owner's word ("yes commit
    and push, and continue with the recommendation").
  - That conversation reviewed T-08, not T-09, so it may implement T-09. **T-09's review must be
    a fresh conversation.**
  - The self-check here is **not** the review.
- **Baseline:** `a8bffb8` (T-08, pushed and live on Railway since about 20:30 IST; PC-005 steps
  2–4 passed). The working tree was clean apart from this session's STATE and HANDOFF edits and
  the PC-005 evidence files.
- **Decisions taken:** D-14 (a) and D-16 (a) by default, earlier. D-18 (a) is the owner's word:
  "continue with the recommendation".
- **Review input:** the SHA-256s below are of the files as on disk. All are LF on disk except
  `index.html`, which stays CRLF on disk and LF in git (N-2). Deleted:
  - `firestore.rules`, `firebase.json` and `tests/rules/firestore-rules.test.js`;
  - `docs/google-play/FIRESTORE_RULES.md`.

  The deletions are not staged: nothing was committed or staged in this phase.

| File | SHA-256 | Line ends |
|---|---|---|
| `index.html` | `e34dfe64487fd7590f022abd14d51d34b1fb2e2e7c3de78dde32112cae73b5f3` | CRLF |
| `service-worker.js` | `c54086475abbdc0768c7275ba40c9875be6552374be119dc6311caaf69abe3bb` | LF |
| `money.js` (comments only) | `b3660b72bdb37fd010249b2bbbf764f8414d0ebb1815876a2a679ef00d117e12` | LF |
| `group-code.js` | `12a29726d6c87918f2fcf010d9533dc7e19264e472746554651c194440cd6aae` | LF |
| `sync-status.js` | `717ceb040b2f0f9525c701d6ba403bad686fabd0dc569b126ab32057dd06e52c` | LF |
| `ledger-rules.js` | `8d26c5164bf9d2d8c87af1683d336631a6227a79192818af5f1ba80ae14d2a8d` | LF |
| `ledger-client.js` | `56d0bd8ed2f3196cdc68c1af2612ede3a31756ff44562ee66019b4448102cbf1` | LF |
| `outbox.js` (new) | `9f9783e219bd9df526305ab217578ca01425b5963abdf438735f14b02b89ffe6` | LF |
| `server/api.js` | `66e21d9927c7ac4a1341b1067b8c07fc8a7a0ed2bb4df88157cb4d7332f67231` | LF |
| `server/db.js` | `b02f9e3ef571c7142ab9c8f3d7f11f1874111dbb68a80416e74714f2d1fc1a8e` | LF |
| `server/server.js` | `cdecc1e8f6eb11b666ed3ac0422216d95e33d3ec06fbe62518c14618045271b6` | LF |
| `server/main.js` | `42eb77d8a3199a81852e8a583eb5a06c316bcea17c141edd4675edbe781dda11` | LF |
| `server/static.js` | `90e77cd56c079527581218cee54fdc364eb00f677a023319e6f3728a55e982a7` | LF |
| `Dockerfile` | `db7ac8f19a2805610414ba0fd8976e29f10590889ec285cad4883da8ef70eaba` | LF |
| `.dockerignore` | `bdc08c57738cba1b5f34abbee796517e17d2095b9569a8375f02176cf7a3bc4f` | LF |
| `package.json` | `b5425bc3f0088f6ded08a4dcff4580d158e3bfb8e81d478fbdaae63db2582482` | LF |
| `package-lock.json` | `8ecb3ce62a972376244e93b505ee444ed65f100379b60fdb2c525d5e06efa533` | LF |
| `scripts/move-from-firestore.mjs` (new) | `55c49413a79a5122c0aa98138c454edfa4ed8c6ea1809e9f780e946dd81ec089` | LF |
| `tests/group-code.test.js` | `8ebe12a7a191b046e6a0c031498d567418b926ab0ca623f772965bc90963ff14` | LF |
| `tests/ledger-rules.test.js` | `e6241d4c0bc6318babc77c6bc75ccce3a69279f9445ee3637733d7e3c6962be3` | LF |
| `tests/move-from-firestore.test.js` (new) | `454668c1b234fe52f51a99c7fe001bc6fbdd33318560dbab9dc7e35fc8d61518` | LF |
| `tests/outbox.test.js` (new) | `de902cb2f322aa7613ec500962ff805e91017d78608b444c276ee23ea49bde6f` | LF |
| `tests/page-client.test.js` (new) | `8b131472ee7be894adb528724e34fa90f220390295d096ac82ac83851a382030` | LF |
| `tests/server-api.test.js` | `f8330cda2c25bdef5ca7cc327f2e9d22df775fe79f171722461ffdce3c27fc5a` | LF |
| `tests/server-db.test.js` | `c634f6a0db869e4e7add4cc98f838f0cb58f285da43e1cfa3426b2e9bd74cc64` | LF |
| `tests/server-static.test.js` | `b0deb340b29360aed8e5bbc146bad7e40806f0884fb69eb755a61d1af9b629c8` | LF |
| `tests/service-worker.test.js` | `7960b57beffddf818fa7b440da104745e3ec0d274d0eef4609795145c0a0d927` | LF |
| `tests/sync-status.test.js` | `08b36160b067a7ece7e299d431ae60d82a927d99c41ec26a5699b50ab7437be1` | LF |
| `tests/wiring.test.js` | `7037f1f985123be8a92a8ceedc3fdc958756b7e452d2a19dbf3b43c8bcb08b9e` | LF |
| `docs/google-play/MOVE_FROM_FIREBASE.md` (new) | `d5a3987ebba821962181acb90156d7eb249c1970cbec4c7680c26df351d7184d` | LF |
| `evidence/T-09-break-checks.mjs` (new) | `fe8e5d7c7f7a82a667bf99d7f345c54ab2726ada5933cfe0bb9e0173f1c9ee2a` | LF |
| `evidence/T-09-browser-check.mjs` (new) | `4e1a757174395041e1e46ed07cb3c3cb2c51814ecc71dfc64da6ac713e2f3ca2` | LF |
| `evidence/T-09-read-cost-probe.mjs` (new) | `546d1b07da1db5721f483155059c18d328519d05a20fa24cd23c0a0f04238c99` | LF |

## What it does, in one example per story

- **SF-035:** Asha opens the family's invite link on the Railway address.
  - The page reads the group from `GET /api/group`, with the code in the `X-Group-Code` header.
  - When Ben adds "Taxi" on his phone, Asha's page hears the new version on its live
    connection, reads the group again and shows Taxi.
  - Not one request goes to a Google or Firebase host, except the fonts.
- **SF-036:** On a trek with no signal, Asha deletes "Chai" and adds "Taxi ₹250.00".
  - The bar says "offline: 2 changes waiting to sync". Taxi shows "waiting to sync", and the
    balances already include both changes.
  - Back in range, both reach the server in order, and the bar says "live".
  - Opening the app again with no signal shows the group from the phone's copy.
- **SF-037:** At the switch-over, the dry run lists each group's counts and balances.
  - The copy sends each group to the server, with ₹99.50 stored as 9950 paise and the same IDs.
  - It then reads every group back and says "Every balance matches to the paisa".
  - The expense with the amount `"12"` is listed and left out. It isn't counted today either,
    so no balance changes.
- **SF-038:** A phone still on the old GitHub Pages address shows "SplitFamilia has moved". Its
  button opens `https://splitfamilia.up.railway.app/?g=<the same code>`. The repo no longer
  has any Firebase file, setting or dependency.

## Per-story status

| Story | Done? | Acceptance criteria met | Notes |
|---|---|---|---|
| SF-035 | Yes | All. The browser check covers "live", the ₹100.00 and ₹0.05 splits, and no Google host except the fonts | The `#g=` link option still needs **OWNER CONFIRMATION REQUIRED** (D1) |
| SF-036 | Yes, D-14 (a) | All: the phone's copy in IndexedDB, the outbox, the honest status with deletes counted, balances while waiting, two phones | The browser check ran E2/E3, E6 and an offline reopen |
| SF-037 | Yes; the real run waits for the switch-over | All in the code and tests (fake Firestore, and a local server end to end). **Running it against production needs the owner's word** (CLAUDE.md §5) | Codes and token come from git-ignored files (D6) |
| SF-038 | Yes; the switch-over itself is the owner's | All: the guide, the old-address notice, Firebase removed, the no-Firebase check, and the pending checks (PC-006 in STATE). Also D-18 (a), N-5, N-6 and N-7 | Two pushes (D5) |

## Changes

| File | What changed |
|---|---|
| `index.html` | The module talks only to the server: `getGroup`, `sendChange`, `watchGroup`, and an outbox for every change (`crypto.randomUUID()` IDs). It reads the group once per (re)connect and whenever the version moves, and shows the phone's copy at once. The Firebase imports, config and `groupExists()` are gone. It checks with `ledger-rules.js` before sending (F-6). It adds a "moved" card for `*.github.io`, a dashed chip for a person still waiting, and a new start-up comment. The `fonts.gstatic.com` preconnect hint was removed |
| `ledger-client.js` | Adds `request`, `getGroup`, `changeRequest` and `sendChange`. The code is always in the header. Status 0 means no connection or no answer within 15 s |
| `outbox.js` (new) | `outcome`, `applyChange`, `overlay`, `forBalances`, `createOutbox` (ordered, one flush at a time, a lock across tabs), `memoryStore` and `openBrowserStore` (IndexedDB: `outbox` and `copies`) |
| `sync-status.js` | `friendlyError` knows the server's codes. A 409 or 400 picks its words by `field` and by what was being saved. `countPending` (Firestore's) is gone; `syncStatusText` is unchanged |
| `group-code.js` | `HOME` and `movedLink(href, savedCode)` |
| `money.js`, `ledger-rules.js`, `server/api.js` | Comments no longer mention Firebase. `ledger-rules.js` adds `MAX_SPLIT_ENTRIES` (20,000) |
| `service-worker.js` | Cache `splitsheet-v6`; the new modules in `SHELL`; no `SDK` list; never handles `/api/`; fetches the page as `./index.html`, without `?g=` |
| `server/api.js` | `POST /api/import` (only with a token of 24 or more characters; a wrong token gives 404; not counted by the limits). The split-entry cap. Each group's answer built once per version, shared, gzipped on the worker threads, within a 32 MB budget. `readJson` takes its limit (16 KB, or 4 MB for the import) |
| `server/db.js` | `splitEntryCount()` and `importGroup()` (one transaction, one version step) |
| `server/server.js` | `/healthz` answers 503 without a database (N-5); passes the new options |
| `server/main.js` | Reads `IMPORT_TOKEN` and logs only whether the endpoint is on |
| `server/static.js`, `Dockerfile`, `.dockerignore` | Serve and ship `ledger-rules.js`, `ledger-client.js` and `outbox.js` |
| `scripts/move-from-firestore.mjs` (new) | SF-037's copy: Firestore REST reads (with paging and groups without a document), the plan, the report, the import, and the read-back check |
| `firestore.rules`, `firebase.json`, `tests/rules/`, `FIRESTORE_RULES.md` | Deleted. `package.json` has no devDependencies and no `test:rules`; `package-lock.json` lists nothing |
| Tests | New: `outbox.test.js` (14), `page-client.test.js` (9), `move-from-firestore.test.js` (11). Changed: `sync-status`, `service-worker`, `wiring`, `group-code`, `ledger-rules`, `server-api` (+4), `server-db` and `server-static` |

## Decisions for the reviewer

- **D1, the `?g=` note (SF-035):** of the card's two options, this does the one that changes no
  link. The worker fetches `./index.html` without the query.
  - So an invite code reaches the server's request log only on a phone's very first open, before
    the worker is installed. The browser check saw no `?g=` on the Railway-like origin after that.
  - `#g=` links would close that gap too, but they change the link format, so they still need
    **OWNER CONFIRMATION REQUIRED**.
- **D2, no gstatic mention:** SF-035 and SF-038 say no shipped file mentions gstatic, so the
  `fonts.gstatic.com` preconnect hint went. It only saved a connection's set-up time; the fonts
  still load from Google Fonts' stylesheet.
- **D3, a new group waits for its create:** the live connection starts only once the server
  confirms the group's create. Otherwise the connection can reach the server first, get 404 and
  stop for good.
  - The create is marked `create: true`, so a waiting currency change doesn't hold the
    connection back.
  - A 404 while a create waits isn't "not found".
- **D4, the outbox's outcomes:**
  - 2xx is confirmed.
  - A 4xx other than 408 and 429 is refused: dropped, with one message naming the change.
  - Everything else waits: tried again after 5 s, doubling up to a minute, or after the server's
    `Retry-After`. A 500 never drops a change.
  - A confirmed change moves into the phone's copy at once, with the answer's version when it
    follows on. So a row never blinks out while the next read is on its way.
- **D5, two pushes for the switch-over (SF-038):** the copy needs the import endpoint on Railway
  before the new page ships.
  - Push A holds only 10 files: the server's four, `ledger-rules.js`, the script and its tests.
  - The page, `server/static.js` and the Dockerfile are untouched in push A. That's why
    `api.js` keeps its own copy of the gzip test rather than importing `static.js`'s.
  - Checked: `HEAD` plus those 10 files passes `npm test` (155/155). The image check started the
    server as Railway would, with the same 17 files, `storage: volume` and versions 1–4. The
    page files are identical to `HEAD`.
- **D6, the codes and the token never reach the chat (SF-037):**
  - The script reads them from `data/move-codes.txt` and `data/import-token.txt` (git-ignored).
  - It writes the report with names and balances to `data/`, and prints only counts, "group n"
    and a balance fingerprint.
  - A test checks that no printed line holds a code, a name or the token.
- **D7, what the copy leaves out:** an expense `expenseProblem` flags (the page doesn't count it
  today) is listed and not copied, so balances don't change. So is anything the server's shape
  check refuses. That case changes the balances, so the dry run says "NO — decide before
  copying". A person with an unusable name is left out; their shares stay under their ID.
- **D8, D-18 (a):**
  - The cap is 20,000 split entries per group, deleted ones included (the same 409
    `group-full`).
  - A group's answer is built once per version and shared, within 32 MB.
  - gzip runs on Node's worker threads, and only when asked.
  - Measured (`T-09-read-cost-probe.mjs`, random 64-character IDs and descriptions), for the
    largest group allowed (5,000 expenses split 4 ways):
    - 5.2 MB plain and 1.3 MB gzipped, where the second T-08 review measured 37.3 MB;
    - reading it again takes 28–48 ms;
    - ten unread reads kept `/` waiting 24–30 ms, where it was 16.7 s, and memory stayed flat;
    - building it again after a change holds the server about 0.47 s, once per change.
  - For 100 people × 200 expenses: 1.4 MB, 71 KB gzipped, a build of about 0.1 s.
- **D9, who gets a leftover paisa:** people IDs are now UUIDs. A leftover paisa still goes to the first ID in
  code-unit order, so every phone agrees, but which person gets it is random per group. In
  Firestore it was random too (auto-IDs).
- **D10, the old page's Firestore cache:** phones that used the old page keep Firestore's
  IndexedDB cache on the Railway origin. Deleting it would mean naming Firestore in a shipped
  file (against D2's check), and it is the family's own data on their own phone. It goes when
  the site's data is cleared (L4).

## Tests

All run in this conversation, Node 24.21.0, 2026-09-30 (IST).

| Check | Command | Result |
|---|---|---|
| Baseline | `npm test` at the start (T-08's review) | 140/140 |
| Full suite | `npm test` | **180/180** (about 7 s) |
| Push A alone | `git archive HEAD` into a scratch folder, plus push A's 10 files, then `node --test "tests/*.test.js"` | **155/155**. The page files match `HEAD` apart from `git archive`'s CRLF |
| T-09 break checks | `node docs/planning/evidence/T-09-break-checks.mjs` ([output](T-09-break-checks-output.txt)) | **22/22 caught**, every file restored byte for byte (and `sha256sum -c` after). C1–C20 cover SF-035 to SF-038; C21 and C22 rewrite the first T-08 review's R3 and R7 for today's code |
| T-08's break checks, re-run | `T-08-break-checks.mjs`, `T-08-review-breaks.mjs` ([output](T-09-rerun-t08-breaks-output.txt)) | B1–B20: 20/20 caught. R1, R2 and R4–R8 caught; R3 skipped (its text is now `size > maxBytes`, see C21). **R7 was missed on the first re-run:** group reads have their own sender, and only a group read's `no-store` was tested. A new test covers every answer's `no-store`, and then R7 was caught |
| Browser check | `node docs/planning/evidence/T-09-browser-check.mjs <repo> <empty dir>` ([output](T-09-browser-check-output.json)) | B1–B8 below |
| Read cost (D-18) | `node --expose-gc docs/planning/evidence/T-09-read-cost-probe.mjs` ([output](T-09-read-cost-probe-output.json)) | D8's numbers. The 5,001st expense and the 20,001st split entry get 409 `group-full` |
| Image check | `T-08-image-check.mjs <empty dir>`: on the full tree ([output](T-09-image-check-output.txt)), and on push A alone ([output](T-09-pushA-image-check-output.txt)) | Full tree: 19 files staged (with `ledger-client.js` and `outbox.js`), the page files byte-identical, `storage: volume`, no code in the log. `/ledger-rules.js` is now a page file, so its 200 is expected. Push A: T-08's 17 files, same results as T-08 |

The browser check (headless Edge, the real page and server on 127.0.0.1, a temporary database).
The expected values were worked out by hand:

| # | What | Expected | Observed |
|---|---|---|---|
| B1 | First visit | Start screen; the worker caches `splitsheet-v6`: the page, 6 modules at `?v=6`, the manifest, 2 icons; nothing else | Exactly those 10 |
| B2 | Start "Goa trip" | Code `goa-trip-` + 10 random; "live"; the server has the group at version 1 with ₹ | Yes |
| B3 | Asha, Ben, Chitra; Hotel ₹100.00 by Asha split 3; Chai ₹0.05 by Ben split 3 | With the IDs in order Ben < Asha < Chitra: Hotel 3334/3333/3333 (Ben first), Chai 2/2/1 (Ben, Asha). Asha +10000 − 3333 − 2 = **+6665**; Ben +5 − 3334 − 2 = **−3331**; Chitra **−3334**; sum 0 → "Chitra owes Asha ₹33.34", "Ben owes Asha ₹33.31"; "live"; the server holds 10000 and 5 | Exactly |
| B4 | Offline: delete Chai, add Taxi ₹250.00 by Ben split Asha, Ben; then online | "offline: 2 changes waiting to sync"; Taxi "(waiting)"; Chai gone; balances Asha −5833, Ben +9166, Chitra −3333 → "Asha owes Ben ₹58.33", "Chitra owes Ben ₹33.33"; server unchanged. Online: "live"; server: Chai deleted, Taxi 25000 | Exactly |
| B5 | E6: the server stopped (the browser online), add Dev | Never "live" while Dev waits; Dev's chip dashed; back up: "live", and the server has Dev | Seen: "connecting…" and "1 change waiting to sync" only; then "live"; Dev on the server |
| B6 | Offline, server stopped, reopen `/?g=` | The app, from the worker, with the group from IndexedDB (4 people, 2 expenses) and "offline: …"; back online "live" | Yes |
| B7 | Join: unknown code, then the group's link | "No group found with that code…"; then the group opens, "live" | Yes |
| B8 | The same page on a GitHub Pages name (`pages-check.github.io`, mapped to 127.0.0.1) | Only "SplitFamilia has moved", with the link to `https://splitfamilia.up.railway.app/?g=<code>`; no API request | Yes; its requests were the page and its files only |
| — | Every run | 0 page errors, 0 dialogs; no host but Google Fonts; no `?g=` request to the Railway-like origin after the first visit | 0, 0, `fonts.googleapis.com` and `fonts.gstatic.com`; the only `?g=` request was B8's, as GitHub Pages |

Not exercised: a Docker build (no Docker here), Railway's live edge (the stream through its
proxy, `X-Real-IP`), a real phone, and the copy against the real Firestore. That runs at the
switch-over, on the owner's word.

## Documentation

- New: [MOVE_FROM_FIREBASE.md](../../google-play/MOVE_FROM_FIREBASE.md), the switch-over guide
  (**MANUAL ACTION REQUIRED** at each owner step; **OWNER CONFIRMATION REQUIRED** for the
  report).
- `HOSTING_RAILWAY.md`:
  - section 3a gains the 503 note and step 5, the monthly volume check (N-6; **VERIFY IN
    RAILWAY**);
  - sections 6 to 8 point to the guide.
- `README.md` (the repo map, tests, deploying), `CLAUDE.md` (the project today, tests, two rules
  reworded), `REVIEW.md` (the invariants) and `PRODUCTION_AUDIT.md` (T-08 and T-09 notes).
- Story cards:
  - SF-035 to SF-038: implementation notes;
  - SF-037: the 5,000 cap (N-7, earlier today);
  - SF-014, SF-019, SF-021 and SF-027: `test:rules` noted as removed.

## Open limitations and follow-ups

- **L1:** the switch-over itself is not done. Until the owner runs MOVE_FROM_FIREBASE.md, the
  live page still uses Firestore, and **nothing of T-09 may be pushed before its fresh review
  accepts it**. Then push A comes first.
- **L2:** rebuilding the largest possible group's answer holds the server about 0.47 s, once per
  change. With changes capped at 300 per 10 minutes per address, one address can take at most
  about a quarter of the server's time this way. A family's group takes a few milliseconds.
- **L3:** a phone's very first open of an invite link (no worker yet) still sends `?g=` to the
  server, and Railway's request log may record it (D1).
- **L4:** the old page's Firestore cache stays in the browser's storage on phones that used it
  (D10).
- **L5:** the page's own logic in `index.html` (the create race, the refresh on reconnect,
  refusal messages) is covered by the browser check, not by `npm test`, as before T-09. The
  pure parts it uses are unit-tested.
- **L6:** `node_modules/` still holds the old Firebase tools. It is git-ignored and unused now;
  the owner may delete the folder.
