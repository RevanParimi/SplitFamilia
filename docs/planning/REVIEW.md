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
- No test may touch the real Firestore.

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
- **Edits and deletes recompute balances everywhere,** and no expense is counted twice.
- **Access:** a group's data is readable and writable only as the Firestore security rules
  intend. The group link or slug is a capability: treat it like a password.
- **The server's API (from T-08):** a request is answered only for a valid code sent in the
  `X-Group-Code` header, never in a URL, and no endpoint lists groups.
  - Only ledger-shaped data is stored (`ledger-rules.js`); money is stored as an integer
    `amount_paise`. A group holds at most 100 people and 5,000 expenses (deleted ones
    included), and an expense is split among at most 100 (the owner's numbers).
  - After 30 unknown codes from one address in 10 minutes, every API request from that address
    gets 429, known codes too, so a refusal never reveals which codes exist. That holds for
    requests sent together, with bodies arriving late (T-08 review, F-8).
  - One address sends at most 300 changes in 10 minutes (then 429 for its changes, not its
    reads) and holds at most 10 live streams (then 503) (the owner, D-17).
  - No log line holds a code, a name or a description.
  - Sending the same ID again adds nothing, even after a delete: deletes only mark a row.
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
  visit the app starts with no connection: the worker keeps the page, its modules and the two
  versioned Firebase SDK files, and Firestore shows its local copy. Changes the server hasn't
  confirmed are marked "waiting to sync" until it has.
- **Honest status and plain errors:** the group bar says "live" only when the server has
  confirmed what's on screen, including deletes. Firestore doesn't flag a snapshot for a local
  delete, so the page must count its own (T-03 review F-5). People never see Firestore's own error text, and the console gets
  at most an error code: never typed text or a group code.
- **One group per page:** a page load opens at most one group, whatever order "Join" and "Start
  a new group" finish in.

### Release invariants (Google Play stories, from 2026-09-28)

- **No secrets in git:** no keystore, key password, `keystore.properties`, `.env` file or
  service-account JSON is tracked, and `git ls-files` proves it. The Firebase web config is the
  one intended public exception.
- **Release signing:** the release AAB is signed with the upload key from environment variables
  or the ignored properties file, never with the debug key. Every upload raises `versionCode`.
- **Least permission:** the merged release manifest asks only for what the app uses (expected:
  `INTERNET`).
- **HTTPS only:** shipped files contain no `localhost` URLs and no non-local `http://` URLs.
- **Only the app is shipped:** the Docker image holds the app's files and the server's code, and
  nothing else (no docs, tests, tooling, rules, local data or secrets), and every file the service
  worker caches is in it.
- **Honest docs:** store and compliance docs claim only features the code has. Every compliance
  answer cites code or an official page (with the date checked), or says **OWNER CONFIRMATION
  REQUIRED**.
- **Nothing published:** no story uploads to Play or changes Play Console. Deploys happen only
  on the owner's word (CLAUDE.md §5).

## Review receipt

Write `evidence/<T-nn>-review.md` (one per task) from [the template](templates/review-receipt.md). Then update
STATE.json (status, `review_outcomes`, `history`) and HANDOFF.md together.
