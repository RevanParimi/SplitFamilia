# T-04 review receipt — Edit expenses, settle-ups, recent groups, a polished UI and the store listing

- **Task:** T-04. Stories: [SF-022](../stories/SF-022.md), [SF-023](../stories/SF-023.md),
  [SF-029](../stories/SF-029.md), [SF-028](../stories/SF-028.md), [SF-015](../stories/SF-015.md).
  Implementation receipt: [T-04-implementation.md](T-04-implementation.md).
- **Review context:** a fresh-session review, 2026-10-01, about 15:22–15:50 IST, on the owner's
  "start T-04's review". Nothing was committed, staged or pushed.
- **Reviewed input:** verified, with one bookkeeping gap (N-13). 37 of the receipt's 39 hash rows
  match the files on disk, including both image digests. The other two are docs edited during the
  D-19 icon fold-in, at 15:21:37 IST, the same second as the receipt itself; their table rows
  weren't refreshed. The reviewed versions are:
  - `docs/google-play/STORE_LISTING.md`: `4da43efe3e1b788bfaf349ceaab5a9f01b29249e340c82972e6fb43731c3500b`;
  - `docs/google-play/assets/README.md`: `1c006abcad59c3c8730d7293669b2bdae46d38ab3e7ee540163d30d5888154e2`.

  The diff against `db0580b` was read in full for the server, the modules and the page's script.
- **Verdict:** `accepted`. Every acceptance criterion of the five stories is met. No critical,
  high or medium finding; one low finding (F-14) and four notes, all recorded as follow-ups.

## Contract checked and adversarial examples

Expected values were worked out by hand before reading the output. People's IDs sort Asha < Ben <
Chitra (and `p-asha` < `p-long` < `p-markup`), so a leftover paisa goes to the first.

| # | Input | Expected (by the contract, worked out by hand) | Observed |
|---|---|---|---|
| 1 | B1: Dinner ₹1,200.00 (Asha, split 3) edited to ₹1,250.50 | 125,050 ÷ 3 = 41,683 r 1: Asha's share 41,684, Asha +83,366, Ben and Chitra −41,683 each: "₹416.83" twice; on the server the old row deleted and one new row of 125,050 | As expected (implementer's browser check, re-run) |
| 2 | B4: Hotel ₹300 (Ben, split 3); Asha pays Ben ₹40, then the rest (₹60), then ₹40 → ₹50 | Asha −10,000 + 6,000 + 5,000 = +1,000; Ben +20,000 − 11,000 = +9,000; Chitra −10,000: "Chitra owes Ben ₹90.00", "Chitra owes Asha ₹10.00"; the server has two settlements, 6,000 and 5,000 | As expected |
| 3 | P1, rolling back: `db0580b`'s `db.js` opens a database with migration 2, a settle-up (4,000) edited to 10,000 | The old code starts (schema version stays 2), reads the settle-up as an ordinary expense "pay2 10000 p-asha>p-ben" with no `kind`, hides the replaced row, and adds a Taxi (version 7 → 8); T-04's code then reads `kind` again | As expected |
| 4 | P2, a v6 page (as on phones until their worker updates) on T-04's server: Hotel 30,000 (Ben, split 3), a settle-up Asha → Ben 10,000, Dinner 120,000 (Asha, split Asha + Ben) edited to 150,000 | Asha −10,000 + 10,000 + 75,000 = +75,000; Ben +20,000 − 10,000 − 75,000 = −65,000; Chitra −10,000: "Ben owes Asha ₹650.00", "Chitra owes Asha ₹100.00"; the ledger shows "Payment" and ₹1,500.00, no ₹1,200.00 row; cache still `splitsheet-v6` | As expected, "· live" |
| 5 | P3, hostile text at 360 px: a 60-character name with no spaces, a 200-character description with no spaces, the name `<b>Chitra</b>`, the description `<img src=x onerror="window.__pwned=1">`, ₹99,99,999.99 split 3 and ₹10.01 split 2 | 999,999,999 ÷ 3 = 333,333,333 each; 1,001 ÷ 2 = 501 (Asha) + 500. Asha −333,333,834, the long name +666,666,666, `<b>Chitra</b>` −333,332,832 (sum 0): "₹33,33,338.34" and "₹33,33,328.32". No sideways scroll and nothing past the edge on home, People, Edit, the delete confirmation, Record payment, the menu and "Your groups"; the markup shown as text, no element made from it, no script run | As expected (screens in the scratchpad; text wraps inside its card) |
| 6 | P4: offline, Dinner ₹300 (Asha, split 2) edited to ₹400; another phone deletes Dinner; the page opens "Add expense", then goes online | Offline: "Ben owes Asha ₹200.00", "offline: 1 change waiting to sync", the row "waiting". Online: 409 `gone`, one message "Couldn't save the expense “Dinner”. Someone else changed or deleted it first, so this edit wasn't saved."; the server has no expense; the page shows none; "live" | As expected, **but the message is hidden under the open sheet until it closes** (F-14; [screenshot](T-04-review-notice-under-sheet.png)) |
| 7 | P5: offline, Taxi ₹500 (Asha, split 2) waits in "Waiting trip"; Switch group (offline); "Remove from this device"; open "Race trip"; online | The list loses only "Waiting trip"; its IndexedDB copy goes, its change stays; online, the change is sent from the other group's page: the server holds "Taxi 50000 p-asha>p-asha+p-ben"; the outbox ends empty | As expected |
| 8 | P6: offline, Hotel ₹200 (Ben, split 2); record Asha → Ben ₹30 from the balance row (prefilled 100.00), then edit that payment to ₹45 | "offline: 2 changes waiting to sync"; one payment row "₹45.00 · waiting"; Asha −10,000 + 4,500: "Asha owes Ben ₹55.00"; online: the server has the ₹30 row deleted and one live settlement of 4,500 | As expected |
| 9 | P7, PC-009 steps 3–4 rehearsed: `PUT /api/expenses/pc009-probe` with an unknown valid code and a valid body, then `GET /api/group` | T-04's server: 404 `not-found` twice, no group made. `db0580b`'s server (the live one today): 405 to the PUT, 404 to the GET | As expected: PC-009's pass rule matches the code |
| 10 | Two phones edit the same expense; an edit's answer is lost and resent | The second edit gets 409 `gone` and counts once; a resend succeeds and adds nothing, even after the new expense was itself edited | `tests/server-api.test.js` and `tests/page-client.test.js` pass; break R2 shows the resend case is tested |

## Findings

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-14 | Low (confirmed, observed) | `index.html:739` (`#notice`, outside both dialogs), `index.html:784` (`showNotice`) | A message raised while a sheet or the confirmation is open (a refused change, "sync stopped", "Something went wrong") → the message bar is drawn under the modal `<dialog>` (top layer) and is inert. In P4 `elementFromPoint` at the bar's centre hit `split-summary` inside the sheet, and the screenshot shows no message. It appears only once the sheet closes. Expected: the one message bar is seen when it's raised, as on the v6 page, which had no modal sheets | Someone working in a sheet doesn't learn that an earlier change was refused until they close it. Screen readers don't hear the `role="alert"` while it's inert, and it isn't announced again later. Nothing is lost or counted wrong; the change was already refused either way | Follow-up, added to [SF-018](../stories/SF-018.md) (T-06, the next story to change the page): show the bar in the top layer (for example `popover="manual"` and `showPopover()` after a sheet opens, or move it into the open dialog), and re-run P4 to check it's on top |
| N-13 | Note (process) | `evidence/T-04-implementation.md`, the hash table | The D-19 fold-in edited `STORE_LISTING.md` and `assets/README.md` at 15:21:37 IST but left their old hashes in the table | The reviewer can't match those two rows; the content is the D-19 icon text, as the history line says | No change: the reviewed hashes are recorded above |
| N-14 | Note (code reading) | `index.html:1439` (`openExpense`), `index.html:1638` (`openPay`), `index.html:830` (`openSheet`) | Both set `form` or `pay` before `openSheet`, which first runs the previous sheet's close hook. Opening the same panel while it's open would set `form` or `pay` to null, so Save would do nothing. With `showModal` the page behind is inert, so no path reaches it; only the plain-dialog fallback (D6, iOS before 15.4), where rows stay clickable, could | None seen; a fallback-only edge | With F-14 if convenient: run the old hook before setting the new state (noted on SF-018) |
| N-15 | Note (product behaviour, by reading and the API's tests) | `server/api.js` (`DELETE /api/expenses/<id>`) | Phone A deletes Dinner after phone B's edit has replaced it → the delete of the old ID answers 200 and changes nothing, so the edited Dinner stays and comes back on phone A with no message. An edit that loses gets 409 `gone` and a message; a delete that loses gets none | Never counted twice and no balance wrong; A may need to delete it again | No change now. A message would need the server to remember which row replaced which |
| N-16 | Note (test gap, accepted) | `outbox.js` `openBrowserStore` (`deleteCopy`) | Break R12 (the IndexedDB `deleteCopy` does nothing) passes `npm test`: Node has no IndexedDB, so the store is only run in the browser. Browser check B8 and probe P5 cover it | None while the browser checks are re-run on page changes | No change |
| O-3 | Observation (tooling) | `evidence/T-04-make-icons.mjs` | The handoff says to run it with a scratch folder and compare its output; it writes the three icons into the repo root (only the preview goes to the scratch folder) | Re-running it rewrote the icons at 15:35:52 IST, byte-identical to the receipt's hashes, so the build is reproducible. A changed source image would overwrite them | No change |

## Commands and results

| Check | Command | Result |
|---|---|---|
| Input | `sha256sum` of each file in the receipt's table; the image digests | 37/39 rows and both digests match; 2 docs differ (N-13) |
| Unit and integration | `npm test` (Node 24.21.0) | **214/214** pass, 0 fail |
| Implementer's browser check | `node docs/planning/evidence/T-04-browser-check.mjs . <scratch> <shots>` | Done in about 2 minutes; all 59 sections identical to the receipt's recorded output once random codes, IDs and times are masked; key values re-worked by hand (rows 1–2 above, B2, B10); 0 dialogs, 0 page errors, 0 timeouts, 0 unexpected refusals |
| Implementer's break checks | `node docs/planning/evidence/T-04-break-checks.mjs` | **24/24 caught**; every file restored (hashes and `git status` unchanged) |
| This review's break checks | `node docs/planning/evidence/T-04-review-breaks.mjs` ([output](T-04-review-breaks-output.txt)) | **14 of 16 caught**: R1 (an edit doesn't move the version), R2 (a resend refused after a later edit), R3 (an edit skips the people check), R4 (the phone shows an edit of a missing expense), R5 (edit split entries uncounted), R6, R7 (the database takes any `kind`), R8 (a settle-up with extra fields), R9–R11, R13, R15, R16 (a payment's edit loses its mark). R12 missed, as expected (N-16). R14 missed because the code it removes is redundant: a link or code with a leading bracket or quote is already handled by URL resolution and `slugify`, so the trim changes no answer. Every file restored |
| Contrast | `node docs/planning/evidence/T-04-contrast-check.mjs .` | **33/33** pass WCAG AA; output identical to the receipt's |
| Icons | `node docs/planning/evidence/T-04-make-icons.mjs . <scratch>` | The three icons rebuilt byte-identical (O-3); preview checked by eye: no white corner, the "S" inside the 80% circle |
| Store listing | the 29 file:line references (28 places) read one by one; counts in code points and UTF-16 units | Every reference points at the named code; name 12/30, short 79/80, full 1,796/4,000; no emoji; no "best", "free", "top" or "#1" |
| Graphics | PNG headers | 7 screenshots 1,080 × 1,920, colour type 2 (RGB); feature graphic 1,024 × 500, colour type 2; `icon-512.png` 512 × 512, colour type 6, 265,424 bytes |
| This review's probe | `node docs/planning/evidence/T-04-review-probe.mjs . <v6 dir> <scratch> <shots>` ([script](T-04-review-probe.mjs), [output](T-04-review-probe-output.json)); `<v6 dir>` is `git archive db0580b` (LF) plus `recent-groups.js` | P1–P7 as in the table above; run twice, P1–P6 identical; 0 dialogs, 0 errors, 0 timeouts |

Files this review added: `T-04-review.md` (this receipt), `T-04-review-breaks.mjs`
(`00c69095…c4f411a`), `T-04-review-breaks-output.txt` (`fbe1d2ee…3238d0e`),
`T-04-review-probe.mjs` (`739457fb…c8333f`), `T-04-review-probe-output.json`
(`6f9f9daf…979fe7`), `T-04-review-notice-under-sheet.png` (`381ec4e9…15bd92`).

Not exercised:
- a real phone, safe-area insets, iOS Safari and the `showModal` fallback (headless Edge only; the
  CSS uses `env(safe-area-inset-*)` on the header, gutters, add bar and sheet footers);
- screen-reader speech (F-14's "not announced" is from the inert state, not from listening);
- the clipboard fallback box;
- the live Railway service: nothing was pushed (PC-009 is for after the push).

## Acceptance checklist

| Story | Criterion | Verdict |
|---|---|---|
| SF-022 | Description, amount, payer and split can be edited, with the same checks as adding | Met: the same form and `checkExpense` on the page and the server; B1, B2, B6 |
| SF-022 | The rules allow an update with the same shape checks (as changed by the move to Railway: the API) | Met: `PUT /api/expenses/<id>` runs `checkExpense` with the group's people; denied cases tested; R3 caught |
| SF-022 | Balances recompute; never counted twice | Met: the old row marked deleted in the same transaction; 409 `gone` for a beaten edit; rows 1, 6 and 10; C1, C2, R4 |
| SF-022 | Cache bumped | Met: `splitsheet-v7`, `?v=7`; the wiring test agrees |
| SF-022 | Update RELEASE_TESTING.md, STORE_LISTING.md, PLAY_CONSOLE_DECLARATIONS.md if they exist | Met: the listing includes edits; the other two don't exist yet, and notes are on SF-016 and SF-019 |
| SF-022 | Tests: an edit moves balances by exactly the difference, still summing to 0 | Met: tested in `tests/server-api.test.js`; row 1 by hand |
| SF-022 | F-5 and F-7 hold for edits; F-11 and F-12 fixed | Met: an offline edit is counted (B2, row 6); a bad code is refused (test); B11 and B12 |
| SF-023 | Stored as an expense paid by the debtor, split to the creditor alone, `kind: "settlement"`; old data without `kind` works | Met: migration 2; `readGroup` adds `kind` only to settle-ups; rows 3 and 4 |
| SF-023 | Shown in the ledger as "Ben paid Asha", not as an ordinary expense | Met: "Asha paid Ben \| 1 Oct · payment" (B4, P6) |
| SF-023 | The checks accept the new field | Met: `kind` must be "settlement", paid to exactly one other person; C9, C10, R8 |
| SF-023 | Declarations and testing docs updated if they exist | Met: they don't exist yet; notes on SF-016, SF-017 and SF-019 |
| SF-023 | Tests: A owes B ₹100, A → B ₹100 → 0; a part payment of ₹40 → ₹60 | Met: both tested; B4 and P6 by hand |
| SF-029 | Each opened group remembered on this device only (codes and times); the current-group key unchanged | Met: `splitfamilia-recent`; `splitsheet-group` as before |
| SF-029 | "Your groups" on the welcome screen, most recent first; a tap opens one | Met: B7, P5 |
| SF-029 | "Switch group" goes back to the list and doesn't forget; "Remove from this device" never deletes server data | Met: B7, B8 (the server still has it), P5 |
| SF-029 | Capped at 20; invalid entries dropped with SF-005's validator | Met: `MAX_RECENT`; `isValidGroupId` passed in; C15–C17, R10 |
| SF-029 | Pure module tested with `node --test`; cache bumped | Met: `tests/recent-groups.test.js` (8) |
| SF-029 | Privacy docs note that codes are stored on the device | Met for now: the docs don't exist yet; the facts are on SF-016, SF-017 and in PRODUCTION_AUDIT.md |
| SF-029 | One group per page load (F-3) | Met: B9 (two taps, one group, one stream) |
| SF-028 | Tap targets at least 44 × 44 | Met: B14, 8 screens × 4 widths, none small |
| SF-028 | Deleting or removing asks first, naming the item | Met: "Delete ‘Dinner’ (₹1,250.50)?" (B3), "Remove Zed from the group?" (B5) |
| SF-028 | Balances near the top; the add form behind a clear button | Met |
| SF-028 | Safe areas; no sideways scroll at 360, 390, 412 and a tablet width | Met: `env(safe-area-inset-*)` in the CSS; B14 and P3 (hostile text at 360 px) |
| SF-028 | Dates show the year when it isn't this year | Met: "30 Dec 2025" (B15); R13 caught |
| SF-028 | Visible focus, labelled inputs, WCAG AA contrast | Met: `:focus-visible`; B16; 33/33 |
| SF-028 | No new libraries; cache bumped | Met: Google Fonts only (wiring test) |
| SF-028 | Before and after shots at 390 px | Met: `evidence/T-04-screens/` (digest verified) |
| SF-028 | `npm test` green; money output unchanged | Met: 214/214; `money.js` unchanged |
| SF-028 | Follow-ups: N-1, no `alert()`, the start-up panel kept, N-8 | Met: C20, C21; B10 |
| SF-015 | STORE_LISTING.md: name, short and full descriptions within limits, claims table with file:line, category with OWNER CONFIRMATION REQUIRED, main features, screenshot list, the three placeholders | Met: every claim and reference checked; counts recounted |
| SF-015 | assets/README.md: current size, format and limits for the icon, feature graphic, phone and tablet screenshots, citing Play Console Help with the date; what fits and what's missing | Met: answer 9866151, checked 2026-10-01 IST; tablet shots missing (optional) |
| SF-015 | Nothing in the listing claims a feature that doesn't exist | Met: checked against the table and the code |

## Decision and follow-up state

- **Accepted** for the reviewed working tree (the hashes in the receipt plus the two above).
  STATE changes:
  - T-04 `review_required` → `done`, with `review_receipt` and a `review_outcomes` entry;
  - `production_verification` → `pending_deployment`;
  - `next_task` T-05, `next_phase` implementation; `active_task` stays T-04 until its push and
    PC-009;
  - a history line.
- **F-14 and N-14** are follow-ups on [SF-018](../stories/SF-018.md). N-13, N-15, N-16 and O-3
  need no change.
- **Production verification:** `pending_deployment`. Nothing is committed or pushed. On the
  owner's word, the working tree is committed and pushed to `main`, which deploys to Railway and
  runs migration 2 once. Then PC-009 (its steps 3–4 rehearsed locally in P7).
