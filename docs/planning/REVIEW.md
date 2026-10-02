# Review checklist (fresh session)

A passing test run does not prove the money is right. Check the story's invariants and data flow
before trusting the test count.

## 1. Verify the input

- Read every story card in the task, the implementation receipt and the actual diff. Check each
  story's acceptance criteria separately; a task passes only if all of its stories do.
- Check that the files match the receipt's hashes or diff digest. If anything drifted, find out
  why before signing off.

## 2. Trace an adversarial example

Take at least one hostile input from entry to storage to every screen that shows it. Examples:
- an odd amount split three ways;
- an edit made while offline;
- two phones editing at once;
- a deleted member who still owes money.

## 3. Check the tests

- The tests must fail on the original bug. Break the code briefly, confirm a test fails, then
  restore it.
- Expected results must be worked out independently, by hand, not copied from the code's
  output.
- No test may touch a real database or reach the network (the server tests run on 127.0.0.1 with a
  temporary database; the move script's tests use fake Firestore answers).

## 4. Run everything once

- Run the focused tests and the full suite once. Anything that changes the page's UI needs a
  real browser check.
- Check that the docs describe the new behaviour.

## 5. Record the findings

- For each finding: its severity, the file and line, the trigger, the observed and expected
  result, its impact and a reproduction.
- Keep confirmed bugs, inferences and product decisions apart. Do not invent findings.

## 6. Give the verdict

- **`changes_requested`** for any unmet acceptance criterion or any critical or high finding.
- **`accepted`** only for the reviewed revision, with its tests passing.
- Record medium and low items as explicit follow-ups.

## This app's invariants

These are the starting set. Adjust them as stories are written.

- **Money in integer minor units** (paise or cents), never floating point. For example, ₹100.00
  split three ways is 3334 + 3333 + 3333 paise.
- **The shares of an expense sum exactly to its total.** The leftover paisa goes to a
  deterministic member, the same on every phone.
- **All balances in a group sum to zero.** Following the suggested settlements brings every
  balance to exactly zero.
- **Edits and deletes recompute balances everywhere,** and no expense is counted twice. An edit
  (T-04) replaces the expense under a new ID; an edit of an expense another phone already
  deleted or edited is refused (409 `gone`), and a resent edit adds nothing.
- **A settle-up only records a payment made outside the app** (`kind: "settlement"`, paid to
  exactly one other person). The app never moves money.
- **No pop-ups for form checks (T-04):** messages go under their fields or in the one message
  bar; deleting an expense or removing a person asks first, naming it.
- **Access:** a group's data is readable and writable only through the server's API, by whoever
  has its code. The group link or code is a capability: treat it like a password.
- **The server's API (from T-08):** a request is answered only for a valid code sent in the
  `X-Group-Code` header, never in a URL, and no endpoint lists groups.
  - Only ledger-shaped data is stored (`ledger-rules.js`); money is stored as an integer
    `amount_paise`. A group holds at most 100 people, 5,000 expenses and 20,000 split entries
    (deleted ones included), and an expense is split among at most 100 (the owner's numbers,
    D-17 and D-18).
  - After 30 unknown codes from one address in 10 minutes, every API request from that address
    gets 429, known codes too, so a refusal never reveals which codes exist. That holds for
    requests sent together, with bodies arriving late (T-08 review, F-8).
  - One address sends at most 300 changes in 10 minutes (then 429 for its changes, not its
    reads) and holds at most 10 live streams (then 503) (the owner, D-17).
  - No log line holds a code, a name or a description.
  - The server keeps an address in memory only, never stored or logged: in the limiters until
    its last event leaves the window (a sweep every 30 seconds, so at most 10.5 minutes), and in
    the live hub while its stream is open. The privacy policy states that bound (11 minutes), and
    a test checks it still covers the code (T-06 review, F-16).
  - Sending the same ID again adds nothing, even after a delete: deletes only mark a row.
  - A group's answer is built once per version and shared by every reader, and gzipped on
    Node's worker threads, so no read of even the largest group holds the server for long (D-18).
  - The import endpoint (`POST /api/import`) exists only while `IMPORT_TOKEN` is set (24
    characters or more); a wrong token looks like no such path, and the token is never logged.
  - `/healthz` answers 503 when the database can't be opened, so Railway keeps the last good
    deploy.
- **Only the app is served:** the server answers with a fixed list of the app's files
  (`server/static.js`), never its own code, the database, `docs/` or a dotfile other than
  `assetlinks.json`, whatever the path's spelling (`/../`, `%2e%2e`).
- **Updates reach phones:** a change to any cached file bumps the service-worker cache name, and
  the page's module imports carry the same number (`./money.js?v=N`), so an old worker never
  hands a new page an old module. `tests/wiring.test.js` checks the numbers agree.
- **Group codes:** a code from a link, from storage or typed under "Join" is used only if it
  matches `group-code.js`'s pattern (lowercase letters and digits joined by single hyphens, at
  most 80 characters). New codes end in 10 random characters from `crypto.getRandomValues`.
- **Offline:** what works offline keeps working, and pending changes are not lost. After one
  visit the app starts with no connection: the worker keeps the page and its modules, and the
  phone's copy of its group (IndexedDB, `outbox.js`) is shown at once. Each change waits in the
  outbox, in order, until the server confirms it; a refused one (400, 404, 409) is dropped with
  one plain message, and anything else is tried again later. Rows the server hasn't confirmed are
  marked "waiting to sync". The worker never caches or answers `/api/`.
- **Honest status and plain errors:** the group bar says "live" only when the live connection is
  up, the group has been read on it, and no change waits, deletes included (T-03 review F-5).
  People never see the server's own text (`friendlyError` in `sync-status.js`), and the console
  gets at most an error code: never typed text or a group code.
- **No Firebase:** nothing shipped mentions Firebase, Firestore or gstatic, and the page names
  no other site but Google Fonts (`tests/wiring.test.js`).
- **One group per page:** a page load opens at most one group, whatever order "Join" and "Start
  a new group" finish in.

### Release invariants (Google Play stories, from 2026-09-28)

- **No secrets in git:** no keystore, key password, `keystore.properties`, `.env` file or
  service-account JSON is tracked, and `git ls-files` proves it. The import token lives only in
  Railway's variables and a git-ignored file (`data/`).
- **Release signing:** the release AAB is signed with the upload key from environment variables
  or the ignored properties file, never with the debug key. Every upload raises `versionCode`.
- **Least permission:** the merged release manifest asks only for what the app uses (since T-05:
  no permission at all, apart from AndroidX's private signature permission).
- **HTTPS only:** shipped files contain no `localhost` URLs and no non-local `http://` URLs.
- **Only the app is shipped:** the Docker image holds the app's files and the server's code, and
  nothing else (no docs, tests, tooling, rules, local data or secrets), and every file the service
  worker caches is in it. Each shipped file is covered by a `railway.json` watch pattern, so a
  push that changes it redeploys (T-06).
- **The privacy policy is the truth (T-06):** `privacy.html` shows `PRIVACY_POLICY.md` section A
  word for word, and both change whenever the app changes what it sends or keeps (a new third
  party, a new stored field, a deletion feature). The page loads nothing from another site.
- **Messages stay usable over sheets (T-06, F-14):** the message bar is a popover inside the
  topmost open dialog, so it is drawn on top and not inert. A probe for a new sheet or dialog:
  the bar's centre is the topmost element there, and its × works.
- **No private data in git:** no real group code, invite link or person's name in any file,
  example or test (the T-06 audit's D-21). Examples use made-up codes.
- **Honest docs:** store and compliance docs claim only features the code has. Every compliance
  answer cites code or an official page (with the date checked), or says **OWNER CONFIRMATION
  REQUIRED**.
- **Nothing published:** no story uploads to Play or changes Play Console. Deploys happen only
  on the owner's word (CLAUDE.md §5).

## Review receipt

Write `evidence/<T-nn>-review.md` (one per task) from [the template](templates/review-receipt.md). Then update
STATE.json (status, `review_outcomes`, `history`) and HANDOFF.md together.
