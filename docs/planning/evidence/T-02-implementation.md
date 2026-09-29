# T-02 implementation receipt — Play account guide, repo safety check, exact-paise money and safe group links

- **Task:** T-02. Stories, in order: [SF-002](../stories/SF-002.md), [SF-003](../stories/SF-003.md),
  [SF-004](../stories/SF-004.md), [SF-005](../stories/SF-005.md), [SF-006](../stories/SF-006.md).
- **Phase:** implementation, 2026-09-29, about 03:41–04:30 IST. The self-checks here are **not**
  the fresh-session review.
- **Baseline:** commit `8898b50` on `main`, up to date with `origin/main`. The working tree
  already held T-01's uncommitted work (SF-001). At the start of this phase its files matched the
  SF-001 receipt's hashes exactly (`index.html` `4cd79b88…`, `service-worker.js` `d1246a59…`,
  `money.js` `037d72f9…`), and `npm test` passed 11/11. Nothing was committed, pushed or deployed
  in this phase.
- **Review input:** the SHA-256 of each file's working-tree bytes (`sha256sum <file>`). This is a
  Windows checkout with `core.autocrlf=true`, so `index.html` and `service-worker.js` have CRLF
  endings on disk; the other files have LF.

  | File | SHA-256 |
  |---|---|
  | `index.html` | `beebb932b8f8cc0495fa633b8408be6869e14cc3fb86109dc68b4b34d210fee2` |
  | `service-worker.js` | `445f0cf5d38df12001d52957077349668003fc64934443618bb6714f754800d4` |
  | `money.js` | `cd8a67e4c1e52c085c95451439a3c46c8857c0dcd8a5be1105d9a4dc583f4cda` |
  | `group-code.js` (new) | `d8f418fbe3629dedc91a5683083a1cbd39f39d029cd067cd39284fb6c51c86d4` |
  | `package.json` (unchanged) | `88878b9f470ed28a4681b09deb064ff6b9ab1144dd73a7e2a7effbc73a395eef` |
  | `tests/money.test.js` | `308bd7a9702381ad438b8d762f6ae0ca867b9afbe40a156deea5fae985dcea7a` |
  | `tests/group-code.test.js` (new) | `10ee363daf0f8e26a1517a52f3db83272b8a856e5f3772e21c412bf1451f8e15` |
  | `tests/wiring.test.js` | `5b8b2f788f4f2061745b648cc0a815030fc4e38e258ec915846ebdbac305d90b` |
  | `.gitignore` (new) | `4a23b531b571af6c1ec20b52fea30980819429b548567816df41d70b2b94deac` |
  | `docs/google-play/PLAY_CONSOLE_SETUP.md` (new) | `1eea62dc81dbc54d7961f34fb779ee65f12fba32e492f9b611e57018ddf212a2` |
  | `docs/google-play/PRODUCTION_AUDIT.md` (new) | `de217e0e9f2987749da60b8d1ace90f1936c6bcc48a423fd77015bb7ac7c3d6c` |
  | `docs/planning/evidence/T-02-browser-check.mjs` (new, evidence only) | `d2cbfe111ae4d907062eb8afc185f8410f9c1ca4deb114f1d516633fe42186a0` |
  | `docs/planning/evidence/T-02-browser-check-output.json` (new, evidence only) | `ec940e817c5e1c3cc376c842d8a6a7c31315cc5b2f249a5555fd192449d35e49` |

  Diff of the tracked files against the baseline commit:
  `git diff 8898b50 -- index.html service-worker.js | sha256sum` →
  `34b845d7ba1bc0c9f469bc8c9169efc8462bd2aa8b8179ffe2bb27b6db896c0f` (226 insertions, 82
  deletions; this includes SF-001's part).

## What it does, in one example per story

- **SF-002:** The owner has one guide, `docs/google-play/PLAY_CONSOLE_SETUP.md`. For example, it
  says a personal account shows the owner's legal name, country and developer email on Google
  Play, so it recommends a separate SplitFamilia email.
- **SF-003:** `git add` can no longer pick up an upload key by accident:
  `android/upload-keystore.jks` is ignored. The audit lists every brief stage 1 item. The full
  history holds one key-like value, the Firebase web key, which is public by design.
- **SF-004:** Asha pays ₹100 for Asha, Ben and Chitra, and Ben pays ₹50 for Ben and Chitra. The
  balances are now exactly Asha +₹66.66, Ben −₹8.33, Chitra −₹58.33, which sum to ₹0.00. The
  suggested payments are "Chitra owes Asha ₹58.33" and "Ben owes Asha ₹8.33". Two ₹1e308
  expenses no longer freeze the page; they show in the ledger as "Not counted in balances".
- **SF-005:** Opening `?g=goa/trip` shows the join screen with "That group link isn't valid."
  Nothing is saved, and a reload shows the same.
- **SF-006:** "Start a new group" → "Goa trip" opens `goa-trip-bxcdqqwp97` (random each time).
  "Join" with a made-up code says "No group found with that code." The old link
  `?g=goa-trip-2026` still opens.

## Per-story status

| Story | Done? | Acceptance criteria met | Notes |
|---|---|---|---|
| SF-002 | Yes | All. Every manual step labelled; 10 official links fetched 2026-09-29 IST; Decisions section; public-info section; tester recruiting; "nothing in this repo creates or changes the Play account". | Docs only. |
| SF-003 | Yes | All. Audit covers every brief stage 1 item with evidence at `8898b50`; history scan recorded; `.gitignore` has every listed pattern; `git ls-files -ci --exclude-standard` prints nothing; no app file changed by this story. | |
| SF-004 | Yes | All, including the three follow-ups from the SF-001 review (F-1, F-2, empty splits). | Also changes a removed payer (D2). |
| SF-005 | Yes | All. | Owner check on existing codes (D11). |
| SF-006 | Yes | All. | Codes stop guessing through the app; direct API access waits for SF-007 (limitation L1). |

## Changes

| File | Story | What changed |
|---|---|---|
| `docs/google-play/PLAY_CONSOLE_SETUP.md` (new) | SF-002 | The Play developer-account guide. |
| `docs/google-play/PRODUCTION_AUDIT.md` (new) | SF-003 | The stage 1 audit, the history secret scan and the `.gitignore` checks. |
| `.gitignore` (new) | SF-003 | Keys and key settings, local credentials, build outputs, Firebase logs, editor and OS files. |
| `money.js` | SF-004 | Rewritten in integer paise: `MAX_AMOUNT_PAISE`, `toPaise`, `expenseProblem`, `splitShares`, `computeBalances` (returns a `Map`), `simplifyDebts` (integer, no tolerance, always ends), `formatPaise`, `parseAmountInput`. |
| `group-code.js` (new) | SF-005, SF-006 | `isValidGroupId`, `slugify` (moved from the page), `randomCode`, `newGroupId`, `parseInvite`. |
| `index.html` | SF-004 | Imports the new money functions; shows amounts from paise; "Removed person" for missing people; flags left-out expenses in the ledger and counts them above Balances; the add-expense form uses `parseAmountInput` (`novalidate`, so the app's messages show) and stores `paise / 100`; `removePerson` and the ledger no longer throw on a missing `split`. |
| `index.html` | SF-005 | `resolveGroup()` validates `?g=` and the saved code, never saves a bad one, clears a bad saved one, and shows the message on the join screen. |
| `index.html` | SF-006 | New join screen: "Start a new group" and "Join a group", with an alert line. New groups open in-page and write their group document. "Join" parses links and codes and checks the server first. |
| `index.html` | task | Imports `./money.js?v=4` and `./group-code.js?v=4` (D17). |
| `service-worker.js` | task | Cache `splitsheet-v3` → `splitsheet-v4`; `SHELL` lists the versioned module URLs; install skips the HTTP cache (`cache: "reload"`); a cached `?v=` URL is never replaced (D17). |
| `tests/money.test.js` | SF-004 | 27 tests (was 9): SF-001's scenarios in paise, the card's worked examples, F-1, F-2, empty splits, 1,000-group property check, formatting and the amount field. |
| `tests/group-code.test.js` (new) | SF-005, SF-006 | 11 tests. |
| `tests/wiring.test.js` | task | 3 tests (was 2): the page uses both modules, no `parseFloat` or `Math.random` in the page, and the `?v=` numbers match the cache name and `SHELL`. |
| `docs/planning/evidence/T-02-browser-check.mjs` and `-output.json` (new) | task | The browser harness and its final output. Not part of the app or of `npm test`. |
| `CLAUDE.md`, `docs/planning/REVIEW.md` | task | Stack, Data and Tests lines; the cache-bump rule now includes `?v=`; two invariants updated. |
| `docs/planning/stories/SF-007.md`, `SF-008.md` | task | "Follow-ups from T-02" sections (no acceptance criteria changed). |

## Decisions for the reviewer

SF-004 (money):

- **D1: `computeBalances` returns a `Map`, and every amount it and `simplifyDebts` return is in
  paise.** A `Map` makes IDs such as `"constructor"` or `"__proto__"` ordinary keys (F-2) with no
  prototype tricks. Example: `computeBalances([asha, ben], [₹60 paid by "constructor" for A/B])`
  → `Map { asha → −3000, ben → −3000, constructor → +6000 }`. Cost: callers must use `.get()`, and
  the page formats with `formatPaise`.
- **D2: a removed *payer* also keeps their balance.** The card asks this for a removed split
  member. For consistency, a removed payer is treated the same instead of the whole expense being
  skipped, which is how SF-001 pinned it. Example: removed Chitra paid ₹60 for Asha and Ben →
  "Asha owes Removed person ₹30.00", "Ben owes Removed person ₹30.00" (before: nothing shown).
  Cost: a debt to someone who is no longer in the group; the fix is to delete the expense.
- **D3: an empty, missing or malformed `split`, or a missing payer, is left out and flagged, like
  F-1.** Example: a stored `split: []` shows "Not counted in balances: it isn't split with anyone.
  Delete it and add it again." Before, the payer was credited ₹300 with nobody debited, and a
  missing `split` threw while drawing the ledger.
- **D4: "valid amount" is exactly the card's rule, a number in (0, ₹1,00,00,000].** So a stored
  `0.001` counts, as ₹0.00, and changes nobody's balance. A string such as `"300"` is flagged,
  because Firestore has never stored strings for amounts through this app.
- **D5: the amount field is strict about decimals:** `10.555` and `10.500` are both refused
  ("Use at most 2 decimal places."), because the card says "more than 2 decimals".
- **D6: the field stays `type="number"`, and the form gets `novalidate`.** Phones keep the number
  keypad, and the app's own messages replace the browser's bubbles. Text a number field can't
  read (such as `1e`) arrives as `""` with `validity.badInput`, which gets "Enter a number, like
  250 or 99.50."
- **D7: sorting compares UTF-16 code units, never the locale.** Leftover paise go to the first IDs
  in `Array.prototype.sort()` order, and settlement ties go by ID the same way. Firestore auto-IDs
  mix upper and lower case, and `"B…"` sorts before `"a…"` on every phone.
- **D8: the maximum is `MAX_AMOUNT_PAISE = 1000000000` (₹1,00,00,000.00), the card's proposal.**
  The owner may change it; SF-007's rules must use the same number (noted on its card).

SF-005 (links):

- **D9: an uppercase `?g=` is refused, not lower-cased** (as the card directs), because
  lower-casing would open a different document. Text typed under "Join" *is* lower-cased, because
  that is what the old join box always did (it slugified), and phones capitalise the first letter.
- **D10: a `?g=` that is present but invalid, including empty, shows the message; a valid saved
  group is kept.** Opening a bad link doesn't log the phone out of its group. The next plain open
  (the home-screen icon) opens the saved group.
- **D11: `slugify` now trims a hyphen left at the end by its 60-character cut.** The old rule
  could make `aaa…a-` (60 characters ending in a hyphen) from a long name. The new pattern rejects
  that, so such an old group would stop opening from its link. **OWNER CONFIRMATION REQUIRED:**
  check the codes of the groups the family uses (shown at the top of the ledger): if any has a
  capital letter, ends in a hyphen, or has anything other than a–z, 0–9 and single hyphens, say
  so before this is deployed.

SF-006 (codes):

- **D12: the alphabet is a–z and 2–9 without `l` and `o` (32 characters), 10 characters, 50
  bits.** `byte & 31` is uniform because 256 is a multiple of 32. A name with no a–z or 0–9 (for
  example "गोवा") gets the prefix `group-`.
- **D13: a new or joined group opens in the same page (`history.replaceState`) instead of
  reloading.** This lets the new group's first write happen at once. Cost: Back leaves the app
  instead of returning to the join screen. (Before, Back reloaded the same group, so nothing was
  lost.)
- **D14: a new group writes `groups/{code}` with `{ currency: "₹" }` at once.** Otherwise a friend
  who types the code before anyone is added would see "No group found". SF-007's planned rules
  already allow this write.
- **D15: the "Join" check asks the server for the group document, one person and one expense,
  with a 15-second limit.** When `navigator.onLine` is false, or Firestore reports `unavailable`,
  it explains that the code can't be checked yet. Opening an invite *link* skips the check, as
  links always have, so existing links keep working offline and on first use.

The task as a whole:

- **D16: one cache bump for the task (`splitsheet-v3` → `splitsheet-v4`),** because the five
  stories ship together.
- **D17: module URLs carry the cache version (`./money.js?v=4`).** Found in this session: after
  swapping the SF-001 files for the new ones on one origin, the first open of an invite link
  loaded the new page from the network and the **old `money.js` from the v3 cache**, and the page
  broke (`SyntaxError: The requested module './money.js' does not provide an export named
  'expenseProblem'`). A silent version of the same mismatch could show paise as rupees. With
  versioned URLs, a new page's modules are never in an old cache, and the worker never replaces a
  cached `?v=` URL, so an old page never gets a new module. The worker also installs with
  `cache: "reload"`, so the browser's HTTP cache can't hand it old copies. A test fails if the
  numbers disagree. Production phones run the v2 worker, whose page imports no local modules, so
  this protects the deploys *after* T-02 too.

SF-003:

- **D18: the audit's line numbers point at commit `8898b50`,** because T-02 itself changes
  `index.html`. Every cited line was re-read with `git show 8898b50:<file>`.
- **D19: `.gitignore` goes beyond the card's list:** `*.pem`, `*.key`, `*.pfx`, `*.pepk`, `*.log`,
  `.idea/`, `.vscode/`, `.claude/settings.local.json`, and more. `!.env.example` keeps a
  placeholder-only example committable.

## Tests

| Check | Command | Result |
|---|---|---|
| Unit and wiring tests | `npm test` | **41 passed, 0 failed** (money 27, group codes 11, wiring 3), Node 24.21.0, no install, no network. |
| B1 (SF-004 card): float division back | Replace the `splitShares` loop with `total / exp.split.length` shares | **3 failed** (₹100 three ways, the worked example, the property check). Restored byte-identical. |
| B2: leftover paisa follows the split's order | Remove `.sort()` in `splitShares` | **3 failed** (the card's `[c, a, b]` case, one paisa, code-unit order). Restored. |
| B3: no 80-character limit | Drop the length check in `isValidGroupId` | **1 failed** (rejected codes: the 81-character one). Restored. |
| B4: `Math.random` instead of crypto | Swap the default random source | **1 failed** ("never Math.random"). Restored. |
| B5: bare codes only through `slugify` | Remove the lower-case shortcut in `parseInvite` | **1 failed** (a 71-character code was cut to 60). Restored. |
| B6 (F-1): no integer guard in `simplifyDebts` | Remove `Number.isSafeInteger` | The Infinity test **never returns**; the test file dies after about 47 s. That is the freeze F-1 describes. Restored. |
| B7, B8: `?v=` out of step | Page `?v=3` with cache v4; cache v5 with page `?v=4` | **1 failed** each (the versioning test). Restored. |
| Browser check (all five stories' screens) | `python -m http.server 8765 --bind 127.0.0.1`, then `node docs/planning/evidence/T-02-browser-check.mjs http://127.0.0.1:8765 <empty profile>` in headless Edge. Firebase modules are fakes; Firestore hosts are blocked; writes are recorded in the page, not sent. | **0 page errors.** Output: `evidence/T-02-browser-check-output.json`. Run twice; identical apart from the random code. Highlights below. |
| Service-worker upgrade | Serve old files, open, swap in the new files on the same port, open start URL, invite link, start URL (scratch script; same fake modules) | **v3 → v4** (`no-cache` server): consistent at every step, 0 errors, only `splitsheet-v4` left with `/group-code.js`. **v2 (`8898b50`, production) → v4**, plain and `no-cache` servers: 0 errors at every step; old page, then new page. |
| SF-003 ignore checks | `git check-ignore -v --no-index android/upload-keystore.jks android/keystore.properties .env.production android/app/build/x.aab` | All four ignored (`*.jks`, `keystore.properties`, `.env.*`, `build/`). The new app, test and doc files are not ignored. |
| SF-003 tracked files | `git ls-files -ci --exclude-standard` | No output. |
| SF-003 history scan | The commands in `PRODUCTION_AUDIT.md` | 4 commits, 7 paths ever tracked, no key files. One match: `8898b50:index.html:472`, the Firebase web key. 0 PEM keys. |
| SF-002 labels | `grep -c` for the three labels; list numbered steps without a label | 24 MANUAL ACTION REQUIRED, 8 VERIFY IN PLAY CONSOLE, 4 OWNER CONFIRMATION REQUIRED. Two numbered lines have no label on the line itself: line 147 (its label is on the next line) and line 152 (an explanation, not a step). |
| SF-002 links | WebFetch of all 10 cited URLs, 2026-09-29 IST | All opened and support their claims (fee US$25; 12 testers, 14 days, accounts after 13 Nov 2023; public info for personal accounts; D-U-N-S for organisations; verification needs; package-name rules; create-app fields; free can't become paid; Play App Signing and upload-key reset; tester opt-in). |
| SF-002 personal data | `grep -niE 'revan\|parimi\|gmail\.com\|@…'` | Only Google's own placeholder `yourgroupname@googlegroups.com`. |

Browser check highlights (what the page showed):

- ₹300 split three ways: "Ben owes Asha ₹100.00", "Chitra owes Asha ₹100.00" (unchanged).
- ₹100 split three ways: "Ben owes Asha ₹33.33", "Chitra owes Asha ₹33.33". Now Asha's +₹66.66
  matches exactly.
- Removed people: "Ben owes Asha ₹130.00", "Removed person owes Asha ₹40.00" (was "Ben owes Asha
  ₹100.00"; worked by hand: A +20000 −3000, B −10000 −3000, C −10000 +6000).
- Bad stored data (two ₹1e308, an empty split, a missing split, payer `"constructor"`): 4 rows
  flagged, "4 expenses aren't counted…", then "Asha owes Removed person ₹15.00" and "Ben owes
  Removed person ₹15.00". The page did not freeze.
- Amount field, typed with real key input: `""`, `1e`, `0`, `-5`, `10.555`, `20000000`, `1e308`
  each gave its message and stored nothing; `99.5` and `0.29` were stored as `99.5` and `0.29`.
- Links: `?g=goa/trip` and `?g=GOA` → "That group link isn't valid.", nothing saved, same after a
  reload. A saved `bad/value` → cleared, with its message. `?g=goa-trip-2026` → opens.
- New group "Goa trip" → `goa-trip-<10 characters>`, saved, in the address bar, one write
  `set groups/<code> {currency: "₹"} merge`. "Copy invite link" copied
  `…/index.html?g=<code>`, which opened the same group with nothing saved.
- Join: a full link and the old name "Smoke Odd" opened their groups; `made-up-code-2222222222` →
  "No group found…"; `https://…/?x=1` → invalid; empty → "Paste an invite link or code.";
  offline (`navigator.onLine` false) → the offline message.
- Cache `splitsheet-v4` holds `group-code.js`, `money.js`, `index.html`, `manifest.json` and both
  icons.

Not exercised:

- the real Firestore, by design (so the server check in "Join" ran only against fakes);
- a real phone, an installed PWA, iOS Safari, and Chrome (only Edge ran);
- opening the app offline (SF-008);
- the Play Console itself (SF-002 is a guide; nothing was created).

## Documentation

- New: `docs/google-play/PLAY_CONSOLE_SETUP.md`, `docs/google-play/PRODUCTION_AUDIT.md`.
- `CLAUDE.md`: Stack (both modules, `?v=`), Data (paise, `?g=`), Tests (the three test files), and
  the cache-bump rule (bump `?v=` too).
- `docs/planning/REVIEW.md`: the "Updates reach phones" invariant, and a new "Group codes"
  invariant.
- Story cards SF-007 and SF-008: "Follow-ups from T-02" sections.
- README.md is two lines with no instructions; unchanged.

## Open limitations and follow-ups

- **L1: codes stop guessing only through the app until SF-007's rules are deployed.** The live
  database is probably open (D-6), so anyone with the project ID can still list groups through
  Firestore's API. SF-007 denies listing groups. Old groups (no random part) stay guessable by
  name, by design (D-4).
- **L2: existing group codes outside the pattern stop opening** (D11). **OWNER CONFIRMATION
  REQUIRED** before deploying.
- **L3: two different removed people both show as "Removed person".**
- **L4: the group's name isn't stored;** the bar shows the code (`goa-trip-bxcdqqwp97`). SF-028
  (UI polish) could store and show a name; SF-007's rules would need to allow it.
- **L5: the service worker caches one copy of `index.html` per invite link** → SF-008 (on its card).
- **L6: a server without `Cache-Control` can briefly serve the previous page** (seen with
  `python -m http.server`), though never a mix of versions → SF-011's `no-cache` headers; noted on
  SF-008.
- **L7: raw Firestore error text still reaches `alert()`** → SF-009, as before.
- **L8: SF-001's harness (`SF-001-browser-smoke.mjs`) no longer runs against the new page,**
  because its fake Firestore lacks the four new imports, so the page module can't load. Use
  `T-02-browser-check.mjs`.
- **T-01's deploy is still pending.** T-01 and T-02 will ship in one push, so production goes
  from v2 to v4 directly; that path was tested above.
