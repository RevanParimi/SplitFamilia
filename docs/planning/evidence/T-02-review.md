# T-02 review receipt — Play account guide, repo safety check, exact-paise money and safe group links

- **Task:** T-02. Stories: [SF-002](../stories/SF-002.md), [SF-003](../stories/SF-003.md),
  [SF-004](../stories/SF-004.md), [SF-005](../stories/SF-005.md), [SF-006](../stories/SF-006.md).
  Implementation receipt: [T-02-implementation.md](T-02-implementation.md).
- **Review context:** a fresh-session review in a new conversation, 2026-09-29, finished about
  07:50 IST (start not recorded; the browser probes ran at about 07:37 IST). This session wrote
  none of the reviewed code, and it did not reuse the implementation's self-checks as its own.
- **Reviewed input:** verified, **yes**. Nothing had drifted from the receipt.
  - The SHA-256 of all 13 files in the receipt's table matches, including `index.html`
    `beebb932…`, `service-worker.js` `445f0cf5…`, `money.js` `cd8a67e4…` and `group-code.js`
    `d8f418fb…`.
  - `git diff 8898b50 -- index.html service-worker.js | sha256sum` →
    `34b845d7ba1bc0c9f469bc8c9169efc8462bd2aa8b8179ffe2bb27b6db896c0f` (226 insertions, 82
    deletions), matching the receipt.
  - Working tree: `index.html` and `service-worker.js` are modified; everything else is
    untracked. Nothing was committed. The review changed no app file: the four app files' hashes
    were the same after the break checks.
- **Verdict:** `accepted`. Every acceptance criterion of all five stories is met, and there is no
  critical or high finding. One medium and one low finding are recorded below as follow-ups.

## Contract checked and adversarial examples

Expected values were worked out by hand from the story cards, not taken from the code.

| # | Input | Expected (by the contract, worked out by hand) | Observed |
|---|---|---|---|
| 1 | People Asha `a`, Ben `B` (capital ID), Chitra `c`. Asha pays ₹100.01 split `[c, B, a, gone]` (`gone` removed); Ben pays ₹0.05 split `[a, c]`; the removed person paid ₹7 split `[B, c, a]`; Ben pays ₹25 split `[B]`; plus a stored `amount: "12"` and `amount: -5` | ₹100.01 = 10001 p ÷ 4 = 2500 r 1; code-unit order `B` < `a` < `c` < `gone`, so B 2501, the rest 2500. 5 p ÷ 2 = 2 r 1 → a 3, c 2. 700 p ÷ 3 = 233 r 1 → B 234, a 233, c 233. Ben's ₹25 for himself nets 0. **a** 10001 − 2500 − 3 − 233 = **+7265**; **B** −2501 + 5 − 234 = **−2730**; **c** −2500 − 2 − 233 = **−2735**; **gone** −2500 + 700 = **−1800**; sum 0. Payments, largest debtor first: C→A ₹27.35, B→A ₹27.30, removed→A ₹18.00. The two bad amounts are flagged, not counted | `money.js` in Node: exactly these balances and payments, and the same with every split and the expense order reversed. **Edge screen:** "2 expenses aren't counted…", "Chitra owes Asha ₹27.35", "Ben owes Asha ₹27.30", "Removed person owes Asha ₹18.00"; the ledger shows ₹100.01, ₹0.05, ₹7.00, "paid by Removed person", and "—" with the flag on the two bad rows |
| 2 | The same data on production code (`8898b50`) | Float shares; the removed payer's ₹7 is skipped and the removed member's share vanishes: A 74.9825, B −24.9525, C −25.0275 (₹25.0025 missing) → "Chitra owes Asha ₹25.03", "Ben owes Asha ₹24.95" | Exactly that on the v2 page. So the new numbers are a deliberate change (SF-004, D2), and the old ones lost ₹25.00 |
| 3 | A saved valid group, then open `?g=` with `goa/trip`, empty, `a--b`, `..` (`%2E%2E`), `__x__`, `x-`, 81 characters, `Goa-trip` | Join screen with "That group link isn't valid."; the saved group stays (D10); no Firestore path built from the bad value | All 8: that message, saved group kept, **zero** Firestore listeners created. A plain open afterwards opens the saved group |
| 4 | A saved `Goa Trip` (invalid) and no link; a saved `bad/one` plus `?g=goa/trip` | Cleared, with a message; never used | Cleared both times. With both bad, only "That group link isn't valid." shows (the "was cleared" line is dropped); harmless |
| 5 | "Join" with a valid code, and while the server check is still running (made 2 s slow), "Start a new group" | One group opens, and later writes go to the group on screen | **Both open (F-3).** The new group opens, then the check finishes and the page switches to the joined group; writes go to the *new* group. See F-3 |
| 6 | Production (v2 worker, `8898b50`) → deploy the reviewed files, on a server that sends `Cache-Control: no-cache` | First open: the old page, whole and working. Next open: the new page, with only `splitsheet-v4` holding `money.js?v=4` and `group-code.js?v=4` | As expected, 0 page errors. The first open showed the old numbers, the second the exact ones |
| 7 | Right after the deploy, the v2 worker is asked for an invite link it never cached | The new page from the network, with modules from the network, never mixed | New page with the exact numbers at once, 0 errors; then only `splitsheet-v4` |
| 8 | After the upgrade, the site is unreachable (server stopped, `fetch` fails) | The start URL opens from the v4 cache, including both modules | It opened the saved group with the exact numbers. The one logged error is the probe's own `fetch` that proved the server was down |
| 9 | Amount text: `+5`, `5.`, `١٢` (Arabic digits), `1_000`, `0x10`, `Infinity`, `00.00`, `9999999.99`, `10000000.001` | Only plain decimals with at most 2 places in (0, ₹1,00,00,000] | `5.` → 500 p, `9999999.99` → 999999999 p; `00.00` → "greater than 0"; `10000000.001` → "at most 2 decimal places"; the rest → "Enter a number…" |
| 10 | Every paise value p from 1 to 1,000,000,000 (stride 9973) stored as `p / 100` and read back | `toPaise(p / 100) === p` | 0 mismatches |
| 11 | Pasted into "Join": `https://h/index.html?g=goa-trip-abc.` (a trailing full stop) | Card: an invalid link shows the SF-005 message | Refused, "That group link isn't valid." Meets the card; a friendlier trim is note N-1 |

## Findings

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-3 | **Medium** (high impact, low likelihood). New in T-02 (D13: groups now open in the same page) | `index.html` `openGroup()` 594–601, the "Start group" handler 617–626, the "Join" result 647–649; `startApp()` 685 adds new listeners each time it runs | "Join" a code that exists; while it says "Checking…" (up to 15 s on a slow network; "Start group" stays enabled), start a new group. **Observed:** the new group opens; when the check returns, `openGroup` runs again, so the page listens to **both** groups. The bar, address and saved group show the joined group, but the first set of form handlers writes first: "Dev" and a ₹10 expense went to `groups/race-trip-…/…`, the expense using the joined group's person IDs, and the second handler found the fields cleared ("Add a description."). Either group's next update redraws the page with its own data. **Expected:** one group opens; the other request is ignored | Money entered on screen for one group is saved in another, invisibly. After a reload the new group's code is gone (the address was replaced), so that entry is effectively lost | Follow-up → **SF-009** (T-03, the next task that edits the page), noted on its card: open at most one group per page load (for example, return from `openGroup` when a group is already open, and disable "Start group" during a check), and re-run P3 of the probe. SF-029's "recent groups" adds another way to open a group, so it's noted on that card too. Not a blocker: it needs a valid code, a slow check and both forms used within that window |
| F-4 | Low (test gap) | `service-worker.js` 18 and 42; `tests/wiring.test.js` | Break checks R8 and R9: remove "a cached `?v=` URL is final", or install without `cache: "reload"`. **Observed:** `npm test` still passes 41/41. **Expected:** a test fails, because D17 depends on both | A later worker edit (SF-008 touches it next) could silently bring back the old-module-with-new-page break that the implementation reproduced | Follow-up → **SF-008**, noted on its card: add a wiring assertion for both lines |
| N-1 | Note (product) | `group-code.js` `parseInvite()` 56–60 | A link pasted with a trailing `.`, `,` or `)` from a sentence is refused | A retry is needed; nothing is saved or broken | → **SF-028** (join-screen polish), noted on its card: consider trimming trailing punctuation |

Reproductions:

- **F-3:** run [T-02-review-probe.mjs](T-02-review-probe.mjs) (header gives the commands), part P3.
  By hand: throttle the network in DevTools to "Slow 3G", paste a real group's code under
  "Join", tap Join, then type a name under "Start a new group" and tap "Start group" before
  "Checking…" ends. Add an expense: it lands in the new group, not the one named in the bar.
- **F-4:** in a scratch copy, delete `service-worker.js` line 42 (or replace
  `new Request(path, { cache: "reload" })` with `path`), then run `npm test`: 41 pass.

Checked and found fine (no finding): the leftover paisa goes by code-unit order of IDs (`B`
before `a`), whatever the split's order; duplicate IDs in a split still sum to zero; the ₹0.001
case counts as ₹0.00, as D4 says; balances need about 9 million maximum-size expenses before
integers stop being exact; the new "Join" reads (`get` on the group, `list` with `limit(1)` on
people and expenses) are already on SF-007's card for the rules tests; the page's text goes
through `textContent`, so a hostile name or description can't inject markup.

## Commands and results

All runs were on this machine (Windows 11, Node v24.21.0, headless Microsoft Edge), 2026-09-29
IST.

| Check | Command | Result |
|---|---|---|
| Input verification | `sha256sum` on the receipt's 13 files; `git diff 8898b50 -- index.html service-worker.js \| sha256sum` | All match |
| Full suite | `npm test` | **41 passed, 0 failed**, exit 0, about 0.25 s. No install, no network, no Firestore |
| Reviewer's break checks (a scratch copy of the app and tests; the working tree was never edited) | 10 mutations, each followed by `node --test "tests/*.test.js"` | Caught: R1 leftover paise to the last IDs (5 failed); R2 removed payer skipped again (2); R3 `Math.floor` in `toPaise` (2); R4 capitals allowed in codes (2); R5 3 decimals allowed (1); R6 8-character random part (3); R7 form maximum ×10 (1). **Not caught:** R8 and R9 (F-4); R10, the page's `?g=` check removed, which is page wiring that the browser checks cover (row 3 above). The copy passed 41/41 before and after |
| Hand-worked values in Node | A one-off `node --input-type=module` script against `money.js` and `group-code.js` | Rows 1, 9, 10 and 11 above, all as worked out by hand |
| Implementer's browser harness, re-run as HANDOFF asked | `python -m http.server 8765 --bind 127.0.0.1` (PowerShell `Start-Process`, stopped afterwards), then `node docs/planning/evidence/T-02-browser-check.mjs http://127.0.0.1:8765 <empty profile>` | **0 page errors.** Same screens as the receipt's highlights (₹100 three ways → ₹33.33 + ₹33.33; removed people → "Ben owes Asha ₹130.00", "Removed person owes Asha ₹40.00"; 4 flagged rows; each bad amount refused, `99.5` and `0.29` stored; bad links refused; a new group `goa-trip-m9kr8vv9s9` with one `set … {currency: "₹"}` write; Join cases; the offline message). The cache held 9 copies of `/index.html` (L5, on SF-008's card) |
| Reviewer's own browser probe | `node docs/planning/evidence/T-02-review-probe.mjs <repo> <git archive of 8898b50> <scratch>` | Rows 1–8 above. Output: [T-02-review-probe-output.json](T-02-review-probe-output.json). 0 page errors in P1–P3 and in P4b |
| SF-003 history scan, re-run | The commands in `PRODUCTION_AUDIT.md` ("Secret scan", steps 1–3) | 4 commits, the same 7 paths, no key-like path; one match, `8898b50:index.html:472`, the Firebase web key (public by design); 0 PEM keys |
| SF-003 ignore checks | `git check-ignore -v --no-index android/upload-keystore.jks android/keystore.properties .env.production android/app/build/x.aab`; `git ls-files -ci --exclude-standard`; `git ls-files --others --exclude-standard` and `--ignored` | All four ignored (`*.jks`, `keystore.properties`, `.env.*`, `build/`); no tracked file ignored; every app, test and doc file can still be added, and nothing in the tree is ignored |
| SF-003 audit citations | `git show 8898b50:index.html \| sed -n <n>p` for 24 of the cited lines, plus `service-worker.js:28` and `manifest.json` | Every one points at what the audit says (e.g. 472 the API key, 708 the float share, 820 `parseFloat`, 458 the iPhone install text) |
| SF-003 coverage | Compared the audit's rows with the brief's stage 1 list | All 36 stage 1 items appear, plus "search for exposed secrets" and ".gitignore" |
| SF-002 labels and personal data | `grep -c` for the three labels; `grep -niE 'revan\|parimi\|gmail\.com\|@…'` | 24 / 8 / 4 labels; only Google's placeholder `yourgroupname@googlegroups.com` |
| SF-002 links, spot check (3 of 10) | WebFetch of answers 14151465, 13628312 and 6112435, 2026-09-29 IST | Each supports its claim: "a minimum of 12 testers who have been opted in continuously for at least 14 days", for "personal developer accounts created after November 13, 2023"; "Google will display your legal name, your country … and developer email address", full address only if you monetise; "US$25 one-time registration fee", and "a valid government ID and a credit card, both under your legal name" |
| HTTPS only | `grep -nE 'http://\|localhost\|127\.0\.0\.1'` in the shipped files | No matches |

Every browser check used fake Firebase modules and blocked the Firestore hosts, so no real data
was read or written. Browser profiles and the baseline copy stayed in the session scratchpad.

Not exercised:

- the real Firestore, so "Join" was checked only against fakes;
- a real phone, an installed PWA, iOS Safari and Chrome (only Edge ran);
- the other 7 of SF-002's 10 links (the implementation fetched all 10);
- the Play Console itself (SF-002 is a guide).

## Acceptance checklist

| Story | Criterion | Verdict |
|---|---|---|
| SF-002 | Covers personal vs organization (D-U-N-S; which testing rules apply) | Met (§1) |
| SF-002 | Identity verification; contact details and which are public; the fee | Met (§2, §3; fee spot-checked) |
| SF-002 | Package name: format, unique, permanent after the first upload | Met (§4) |
| SF-002 | Creating the app; Play App Signing; upload vs app signing key; a lost upload key | Met (§5, §6) |
| SF-002 | Every owner step labelled MANUAL ACTION REQUIRED; account facts VERIFY IN PLAY CONSOLE; nothing made up | Met |
| SF-002 | Changing facts link the official page with the date checked (IST) | Met (2026-09-29) |
| SF-002 | "Decisions" section with D-1, D-2, D-7 and the closed-test cost | Met |
| SF-002 | What Google shows publicly, a separate brand email, citing answer 13628312 | Met (§3; spot-checked) |
| SF-002 | "Start recruiting testers now" with the steps | Met (§7) |
| SF-002 | Says nothing in the repo creates or changes the Play account | Met (line 7) |
| SF-002 | Tests: labels by grep; links open and support claims; no personal data | Met (3 links re-checked here) |
| SF-003 | Audit lists every stage 1 item with finding, evidence (file:line) and status | Met (36 of 36; citations re-checked) |
| SF-003 | Records the 11 known findings, with grep evidence for the not-applicable items | Met |
| SF-003 | Full-history scan, with commands and results | Met (re-run, same results) |
| SF-003 | `.gitignore` covers every listed pattern | Met (and more, D19) |
| SF-003 | `git ls-files -ci --exclude-standard` prints nothing | Met |
| SF-003 | No app file changes | Met (only `.gitignore` and the audit) |
| SF-004 | Paise at read time with `Math.round(amount * 100)`; stored format unchanged | Met |
| SF-004 | `floor(total / n)`, leftover to the first IDs sorted by ID, independent of split order | Met (rows 1, R1) |
| SF-004 | Integer balances sum to 0; `simplifyDebts` integer, no tolerance, settles to exactly 0 | Met (property test; row 1) |
| SF-004 | A removed person's share stays and shows as "Removed person"; recorded as a decision | Met (D2, rows 1–2) |
| SF-004 | Amounts shown with two decimals from paise | Met |
| SF-004 | The form rejects empty/non-numeric, ≤ 0, > 2 decimals, > the one maximum | Met (row 9; harness) |
| SF-004 | Follow-ups F-1 (freeze), F-2 (built-in names), empty or missing split | Met (tests; harness `smoke-bad`) |
| SF-004 | Cache bump | Met (v4) |
| SF-005 | IDs from the URL or storage used only if they match the pattern (≤ 80) | Met (row 3) |
| SF-005 | Never saves an invalid value; clears a bad saved one; shows a plain message | Met (rows 3–4) |
| SF-005 | Valid existing links such as `?g=goa-trip-2026` open as before | Met |
| SF-005 | A pure function in a module, tested with `node --test`; card's accept/reject lists | Met |
| SF-005 | Uppercase `?g=` refused, recorded as a decision | Met (D9) |
| SF-006 | "Start a new group" and "Join" (link or code) on the join screen | Met |
| SF-006 | New ID = slug + `-` + 10 characters from a 32-character alphabet via `crypto.getRandomValues`; fits the pattern | Met (tests; R6) |
| SF-006 | "Join" reads a link's `g` or a bare code; invalid → the SF-005 message | Met |
| SF-006 | Online, a code with nothing behind it → "No group found…"; offline → can't check yet | Met (against fakes) |
| SF-006 | Old IDs open from links and by typing the exact old name | Met |
| SF-006 | "Copy invite link" shares the full code; a fresh open of it shows the same group | Met (harness) |
| SF-006 | Cache bump | Met (v4) |

## Decision and follow-up state

- **Accepted.** STATE changes: T-02 `status` → `done`; `review_receipt` →
  `evidence/T-02-review.md`; `review_outcomes` gets this review; `production_verification` →
  `pending_deployment`; `active_task` → `null`, `next_task` → `T-03`, `next_phase` →
  `implementation`; a `history` line. T-01's production check now names cache v4, because T-01
  and T-02 ship in one push.
- Follow-ups added to story cards (no acceptance criteria changed): F-3 → SF-009, with a note on
  SF-029; F-4 → SF-008; N-1 → SF-028.
- **Production verification:** `pending_deployment`. T-02 ships with T-01 in the next push to
  `main`, which is a production deploy and needs the owner's word (D-5). After it: open the
  family group on the live site and check the balances (now exact to the paisa, and a removed
  person's share now shows); confirm the cache is `splitsheet-v4` holding `money.js?v=4` and
  `group-code.js?v=4`; open a `?g=` with a `/` in it and see "That group link isn't valid.".
