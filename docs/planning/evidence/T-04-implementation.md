# T-04 implementation receipt — Edit expenses, settle-ups, recent groups, a polished UI and the store listing

- **Task:** T-04. Stories, in order: [SF-022](../stories/SF-022.md), [SF-023](../stories/SF-023.md),
  [SF-029](../stories/SF-029.md), [SF-028](../stories/SF-028.md), [SF-015](../stories/SF-015.md).
- **Phase:** implementation, 2026-10-01, about 10:22–11:20 IST, on the owner's "continue". The
  self-check here is **not** the fresh-session review.
- **Baseline:** `db0580b` (T-09 push B, live on Railway). `npm test` on it: 180/180. The working
  tree already held the previous session's uncommitted record updates (`STATE.json`,
  `HANDOFF.md`, `CLAUDE.md`, `README.md`, `evidence/T-09-pc007-*`); this phase edited
  `STATE.json`, `HANDOFF.md`, `CLAUDE.md` and `README.md` again. Nothing was committed, staged or
  pushed.
- **Decision used:** D-2 (SplitFamilia, answered 2026-09-28).
- **One order note:** the page side of SF-022, SF-023 and SF-029 was built straight into SF-028's
  new layout (sheets, a group menu), instead of first into the old page and then again. Each
  story's server, module and test work came first, in the card order; each story's section below
  lists its own parts.
- **Review input:** SHA-256 of each changed or new file as on disk. Every file is LF on disk,
  `index.html` included (it was CRLF on disk before, N-2; git stores LF either way, so `git diff`
  shows only real changes). Recompute with `sha256sum <file>`.

| File | SHA-256 |
|---|---|
| `index.html` | `93f290ead7a40e91a26e611566ef634e3401c2e1930c30654a30233576213b15` |
| `recent-groups.js` (new) | `e45e75805f8b750fd9cc5ff564f80f332c8b447bbacb2eee4fac1a4b0948934d` |
| `group-code.js` | `66833090f74d084541e125d1852200a22a36bcc2138fac567c71e0efe46120e2` |
| `ledger-rules.js` | `26f1bbd743ebb8aec36d3bd1655259eec3b98efd4144db82344288349b363974` |
| `ledger-client.js` | `c3d35bfc77ddb76868baadac01e385838a971b37b70f7551a309aa0df3ba78a8` |
| `outbox.js` | `267193962dfb2e369ee137ea0ffd09ee90f3d35e1fe1d516df6461df7aa477f7` |
| `sync-status.js` | `91c371dec9d0403c61e657404d5c1d3d7f71425e6a5f2bc722e8aff78ad6df9f` |
| `service-worker.js` | `80809750b429717759bccd674006ffe3bc7fe3e0a872975f4f1570f83999207e` |
| `manifest.json` | `1388fa15fff1b8de4b4bdd3a0d3aec92bc6c76a4c0eee846032aa2b0ce010be6` |
| `icon-512.png` (D-19) | `edc31afe2994ba8df52412ae0b4758de92e875c9029453229124e25565782803` |
| `icon-192.png` (D-19) | `e123d88a85040f71aeb89f398b8e2ebc453b084c14737b663480809d2a0e6cf8` |
| `apple-touch-icon.png` (D-19) | `8f891419178b07a7da34777ad0b9d6a901370c50fd11b446ef66a04588ccda3b` |
| `docs/design/icon/splitfamilia-icon.png` (new, the owner's image) | `7641cf0e346049c096cac05a5e9a32b1a03b78c03e80afe2cffed15c5e3e3bda` |
| `server/api.js` | `8d8a724fd958368cab4010b5d069c4689f99e549b49cb2fcbe252cc0f56dd682` |
| `server/db.js` | `8c9e1cfceee8a025a96140365e37a37c0a809f30fce95d1bee39d3d0c713ed25` |
| `server/static.js` | `46b28e3c1722adf1d74912b0f32d9b629c6da27adcd9643d7722b93597979c7c` |
| `Dockerfile` | `12ba9811366b299aee0ff7568338fd57438dc550874938574b9095f051655bee` |
| `.dockerignore` | `93a7c54fc5481d862543fc7f28f705fe4ce559161ee6b7914161846d5a1d64bc` |
| `tests/recent-groups.test.js` (new) | `6c7b60ff1328781baaf9ae33a3096110c1716830902f51658ba6e5cf6a755248` |
| `tests/group-code.test.js` | `1077316d23509a5fa8af0ecdabeefcb9ffe4f4de8bc16a03253d6ec1891e8f0e` |
| `tests/ledger-rules.test.js` | `99c6e46363c16adcea89062cf95c8b6c6db8f11ea6f219f5efa4197240edfca5` |
| `tests/outbox.test.js` | `566d2149969660f12bb45ff546e20e7d7f9abdd82756f553b861f1cf379e916e` |
| `tests/page-client.test.js` | `818bbc3f166541ceb1373e98b8d1e731e732654946a6f37abdd020bd2d27c1a6` |
| `tests/server-api.test.js` | `f1f33f284d864c0d579bb9e835ecbd62f8017d83dd89694c939ba32d12d8bc67` |
| `tests/server-db.test.js` | `7f8d221826369b71705eb286c4b06ca9cfabffb2f2de18ba0b17621e7e1f0919` |
| `tests/service-worker.test.js` | `60318f9120953dd2d4abf0ff37dc8d59964b952cabc626ff8d26e28a9dc2e90a` |
| `tests/sync-status.test.js` | `05a6eadb4bfac6da9acfbeaff14ecd78e2d1970684be7dcf51cd088eb9f4f3a5` |
| `tests/wiring.test.js` | `a1ba0e27773386949591c9324a5a95f55974d7f5ba75d4c9d48022c84f6f40cd` |
| `docs/google-play/STORE_LISTING.md` (new) | `14afefa91f7f7d78fd5b644855f2c81717d8c25fa8427fc36855379bc6066292` |
| `docs/google-play/assets/README.md` (new) | `4f5c3552c75d1c100592771a2f18d2afa4207cae12c245c8853a395627c30e60` |
| `docs/google-play/assets/*.png` (8 new) | digest `f7ac7070baec6897a644fecccfe7d95108b6a306160f1c3bd8bcd29c212a9035` |
| `evidence/T-04-screens/*.png` (16 new) | digest `7ba2199b91ca2c8114ec72e8b77f7bd6d9bb736514522ee055bf977437516737` |
| `evidence/T-04-browser-check.mjs` (new) | `99f9675a8843c4dbe3aca8848efcb3516781a5b44d020121c61d7efe1e4b8d0e` |
| `evidence/T-04-browser-check-output.json` (new) | `413b816d32bbfe3b95a5f20d5f5b71430cd453ffcd677eb126911c5859dba526` |
| `evidence/T-04-break-checks.mjs` (new) | `6cc951525c8664d0c56f4e74a8606fe5d9197832ffe00322d53ea54dedb6b796` |
| `evidence/T-04-break-checks-output.txt` (new) | `c788dc7f11390f8402fb3cc8e67b1cb0929f17d9b44f0e8cd3744c8d04c8e0d9` |
| `evidence/T-04-contrast-check.mjs` (new) | `84b72f48ce0146f8a94dc728f8aadb03ea6579b57c0c1bb7692e50b0dacc3179` |
| `evidence/T-04-contrast-output.txt` (new) | `97c8a1ac936873b7e6c8f94e83bfb52a07494e412c32472058ddfdfbf02c9830` |
| `evidence/T-04-store-shots.mjs` (new) | `fa9721c05e89cc7d62361e3b0d7c0739a02017a7587ef11fb3c5c819a476b536` |
| `evidence/T-04-flatten-png.py` (new) | `6cff53ddad3b8d900d71c028c3e982a502d67a10aa3116452299be9b20384ed1` |
| `evidence/T-04-make-icons.mjs` (new, D-19) | `7d9ad2e07dc5fc23f6e723b57702ea2dcc15737f21262214cca2def9763b4e2e` |

The image digests are `find <dir> -name '*.png' | sort | xargs sha256sum | sha256sum`. The docs
changed are listed under "Documentation".

## What it does, in one example per story

- **SF-022:** Asha typed ₹1,200 for Dinner instead of ₹1,250.50. She taps the Dinner row, changes
  the amount and taps Save. Every phone shows ₹1,250.50, and Ben's debt to Asha goes from
  ₹400.00 to ₹416.83: a third of the ₹50.50 difference, to the paisa. If Ben had edited the same
  Dinner a moment earlier on his phone, Asha's edit is refused with "Couldn't save the expense
  “Dinner”. Someone else changed or deleted it first, so this edit wasn't saved." It is never
  counted twice.
- **SF-023:** Under Balances, Asha taps "Asha owes Ben ₹100.00". The Record payment sheet shows
  Asha → paid → Ben with ₹100.00 filled in. She changes it to 40 and records it: the ledger shows
  "Asha paid Ben ₹40.00" in green, and the balance reads "Asha owes Ben ₹60.00".
- **SF-029:** The family has a Goa trip group and a Diwali party group. "Switch group" in the
  group menu goes back to "Your groups", where both are listed, most recent first ("Opened just
  now", "Opened yesterday"). One tap opens either. "Edit" → "Remove from this device" takes a group
  off this phone only; its invite link still works.
- **SF-028:** The page now looks like the approved indigo-and-saffron design: a header with the
  group's name, avatars and a quiet sync dot; the balances first; the expenses below; one "Add
  expense" button; sheets for everything else; "Delete ‘Dinner’ (₹1,250.50)?" before deleting;
  "Add a description." under the field instead of a pop-up.
- **SF-015:** `docs/google-play/STORE_LISTING.md` has the name (12/30), the short description
  (79/80), the full description (1,796/4,000), a table tracing every claim to the code, a category
  recommendation and the screenshot order. `docs/google-play/assets/` has seven real-app
  screenshots at 1,080 × 1,920 and a 24-bit copy of the feature graphic.

## Per-story status

| Story | Done? | Acceptance criteria met | Notes |
|---|---|---|---|
| SF-022 | Yes | All (as changed by the move to Railway): edit description, amount, payer and split with the add checks; balances recompute, never counted twice; cache bumped (v7); F-5 and F-7 hold for edits; F-11 and F-12 fixed | Firestore-rule criteria replaced by the API (card's "Changed by the move to Railway"). RELEASE_TESTING.md and PLAY_CONSOLE_DECLARATIONS.md don't exist yet: notes added to SF-016 and SF-019 |
| SF-023 | Yes | Stored as an expense paid by the debtor, split to the creditor alone, `kind: "settlement"`; old data without `kind` works; shown as "Ben paid Asha"; the server's checks accept the field | Declarations and testing docs don't exist yet: notes added to SF-016, SF-017 and SF-019 |
| SF-029 | Yes | Device-only list with codes and times; "Your groups" most recent first; Switch group keeps the group; "Remove from this device"; cap 20; invalid entries dropped with SF-005's validator; pure module tested; cache bumped | The privacy docs (SF-016, SF-017) don't exist yet: the facts are added to both cards and to PRODUCTION_AUDIT.md |
| SF-028 | Yes | 44 × 44 taps; delete and remove confirm, naming the item; balances near the top, add form behind a button; safe areas; no sideways scroll at 360/390/412/768; dates with the year when not this year; focus states, labels, WCAG AA contrast; no new libraries; cache bumped; before and after shots at 390 px | Design differences, where the criteria won, are listed under D12. N-1 and N-8 done |
| SF-015 | Yes | STORE_LISTING.md (name, short and full descriptions within limits, claims table, category with OWNER CONFIRMATION REQUIRED, main features, screenshot list, the three placeholders); assets/README.md (current sizes with the source and date, what fits, what's missing) | The old icon fit Play's format but not the new look (D-19). The owner then gave their own image, and the three icons were remade from it (D11) |

## SF-022 — Edit an expense

**How it works.**
- `PUT /api/expenses/<old id>` with the edited expense under a **new** ID
  (`server/api.js`). In one transaction, the server marks the old expense deleted and adds the
  new one, with one version step (`server/db.js` `replaceExpense`). Nothing is overwritten.
- The checks, in order: the new ID must differ from the old; the same edit sent again (its answer
  lost) succeeds as it is, even if that expense was later edited or deleted again; an old expense
  that is no longer live gives 409 `failed-precondition`, field `gone`; then the limits; then
  `checkExpense` with the group's people, the same as adding.
- The page queues `{ kind: "expense-edit", code, replaces, id, date, … }` in the outbox
  (`ledger-client.js` `changeRequest`; `outbox.js` `applyChange` makes the same change on the
  phone's copy). The edited expense keeps its original date, so the ledger order doesn't jump.
- An edit that changes nothing sends nothing.
- `sync-status.js` words a `gone` refusal: "Someone else changed or deleted it first, so this edit
  wasn't saved."

**F-5 and F-7, for edits.** An offline edit waits in the outbox and is counted ("offline: 1 change
waiting to sync", B2; `tests/outbox.test.js`). An edit under a bad code is refused 400 `code`
(`tests/server-api.test.js` F-7 list; `tests/page-client.test.js`).

**F-11 (T-09 review).** After each flush, a tab still waiting for its group's create starts its
live connection once the create has left the outbox (another tab sent it). B12: tab A starts
"Hike" offline, tab B opens it offline; online, both reach "live" within 25 s without a reload,
and the create is sent once.

**F-12 (T-09 review), option 2 (the page).** A group this phone has never read, and isn't
creating, is "not loaded" (see SF-028, N-8): the currency field is disabled and its handler does
nothing. B11: on an unknown code, offline then online, no change is queued and the server has no
group.

## SF-023 — Record a settle-up

- **Storage:** migration 2 adds `expenses.kind TEXT CHECK (kind IS NULL OR kind = 'settlement')`.
  `readGroup` adds `kind: "settlement"` only to settle-ups, so every ordinary expense reads back
  exactly as before.
- **Checks:** `checkExpense` accepts an optional `kind`, which must be `"settlement"`, paid to
  exactly one person who isn't the payer (`ledger-rules.js` `SETTLEMENT`).
- **The page:** a balance row opens Record payment with the whole debt filled in and "That's
  everything Asha owes. Change it for a part payment." The note shows only while the amount
  equals the whole debt. Saving queues an expense with `desc: "Payment"` and `settlement: true`,
  which the client sends as `kind: "settlement"`. A payment row opens Edit payment (the amount,
  or Delete).
- **Older pages** (a phone still on v6 until its worker updates) read a settle-up as an ordinary
  expense "Payment, paid by Ben, split: Asha": the same balances.
- **Rolling back:** a server from before migration 2 starts on a database that has it
  (`migrate()` runs nothing when the stored version is higher) and ignores the column.

## SF-029 — Keep a list of your recent groups

- **The module:** `recent-groups.js` (pure, no imports). `localStorage` key `splitfamilia-recent`
  holds `[{ code, openedAt, invite? }]`, most recent first, capped at 20. `readRecent` drops
  entries with an invalid code (group-code.js's `isValidGroupId`, passed in), a bad time, or a
  duplicate. It also holds `rememberGroup`, `forgetGroup`, `wantsInvite`, `inviteDone`,
  `shortDate` and `openedText`.
- **Opening:** `startApp` remembers the group each time it opens. The current-group key
  `splitsheet-group` is unchanged.
- **Switch group** removes only the current-group key and loads the page without `?g=`, so the
  welcome screen shows "Your groups". It is still one group per page load (F-3); B9 taps two
  groups at once, and one opens with one live stream.
- **Remove from this device** removes the entry, clears the current-group key if it was that
  group, and deletes the phone's IndexedDB copy (`deleteCopy`, new in both stores). Waiting
  changes stay in the outbox and are still sent.
- `invite: true` marks a group started on this phone, so the guide offers "Invite your group"
  until the link is copied or "Not now". It is the only other field, and it lives in this list.

## SF-028 — Polished, good-looking mobile UI

**The reference:** `docs/design/DESIGN_NOTES.md` and the prototype's source (`docs/design/source/`),
ported into plain HTML, CSS and JavaScript with no library. Every existing behaviour is kept: the
start-up panel and its texts, the moved notice, sync, the outbox, offline start and the status
texts word for word.

**Screens and parts:**
- welcome ("Your groups", or the intro card when empty; Start a new group; Join with a link);
- the group header (name button → menu; sync dot or pill; avatars → People; dashed + → add a
  person);
- the guide;
- a "not loaded" card (N-8);
- balances (tap one to record a payment) and the expenses;
- a fixed "Add expense" bar;
- one bottom-sheet `<dialog>` for the menu, People, Start a new group, Join, Add/Edit expense and
  Record/Edit payment, plus an `alertdialog` for confirmations.
- On a tablet (from 700 px) the home has two columns and the sheets are centred panels.

**Acceptance criteria:**
- **Tap targets:** B14 measured every visible button, link, select, input and checkbox row on 8
  screens at 4 widths: none under 44 × 44.
- **Confirmations:** "Delete ‘Dinner’ (₹1,250.50)?" (B3) and "Remove Zed from the group?" (B5).
- **Balances near the top; the add form behind a button.**
- **Safe areas:** `env(safe-area-inset-*)` on the header, gutters, the add bar and sheet footers
  (read in the CSS; headless Edge has no insets to test with).
- **No sideways scroll** at 360, 390, 412 and 768 px (B14).
- **Dates:** "30 Dec 2025" against "1 Oct" (B15; `tests/recent-groups.test.js`).
- **Focus and labels:** `:focus-visible` is a 3 px brand outline, white on the header. Every
  input and select has a label (B16).
- **Contrast:** 33 of 33 text and border pairs pass WCAG AA (`evidence/T-04-contrast-output.txt`).
  It found the design's sync pill at 4.37:1 (white on white 18% over indigo); the pill is now
  14%, 4.73:1.
- **No new libraries:** Google Fonts as before, now Plus Jakarta Sans and Inter. The wiring test
  still allows only `fonts.googleapis.com`.
- **Cache:** `splitsheet-v7`, `?v=7`.
- **Before and after shots at 390 px:** `evidence/T-04-screens/` (see Tests).

**Follow-ups closed here:**
- **N-1:** `parseInvite` drops brackets, quotes and a full stop or comma around a pasted link.
- **T-03's notes:** the start-up panel is restyled (role="alert" kept); there are no `alert()`
  calls (a new wiring test checks); "waiting to sync" is a pill on the row.
- **N-8:** an offline open of a group this phone has never read says "Not loaded yet. Connect to
  see this group." The add buttons and the currency field wait until the group loads (B10).
- **F-6's leftover:** a refused write gets its own words, "Couldn't save the expense “…”." plus
  `friendlyError` (done in T-09; kept).

## SF-015 — Store listing draft and graphics guide

- `docs/google-play/STORE_LISTING.md`: texts, counts, the claims table (file:line for this tree),
  the category recommendation (Finance; Travel and Local and Productivity weighed;
  **OWNER CONFIRMATION REQUIRED**), the main features, the screenshot order, and the
  `<SUPPORT_EMAIL>`, `<SUPPORT_WEBSITE>`, `<PRIVACY_POLICY_URL>` placeholders.
- `docs/google-play/assets/README.md`: Play's requirements (checked 2026-10-01 IST on Play Console
  Help, answer 9866151), and per asset what fits.
  - `icon-512.png`: first the old green design, which fit the format but not the look (D-19).
    It is now made from the owner's image: 512 × 512, 32-bit, 265 KB, opaque (D11).
  - The design's feature graphic is RGBA, which Play doesn't accept. Its pixels are all opaque, so
    `T-04-flatten-png.py` wrote an identical 24-bit copy.
  - Seven phone screenshots of the real app; no tablet screenshots (optional).
- **Character counts:** counted from the `text` blocks, in code points and in UTF-16 units (equal:
  no emoji): name 12 of 30, short 79 of 80, full 1,796 of 4,000.
- **Cross-check:** while writing it, two claims were found stronger than the code and softened.
  - "In the fewest payments": `simplifyDebts` pays the largest debt first, which doesn't always
    give the fewest payments. It now says "as a short list of payments".
  - "Every group you've opened": it is the 20 most recent.

## Changes

| File | What changed |
|---|---|
| `index.html` | Rewritten to the approved design (CSS, markup, module). The sync, outbox and start-up logic is the same; new: sheets, menu, guide, confirmations, field errors, edit and payment flows, "Your groups", not-loaded state, F-11 and F-12 fixes, `storage` listener |
| `recent-groups.js` | New pure module (SF-029) |
| `group-code.js` | `groupName(code)`; `parseInvite` trims surrounding punctuation (N-1) |
| `ledger-rules.js` | `SETTLEMENT`; `checkExpense` accepts `kind: "settlement"` (to one other person) |
| `ledger-client.js` | `expense-edit` → `PUT /api/expenses/<replaces>`; `settlement: true` → `kind` |
| `outbox.js` | `applyChange` for `expense-edit` and settle-ups; `deleteCopy` in both stores |
| `sync-status.js` | Texts for `gone` and `group-full:expense-edit` |
| `server/db.js` | Migration 2 (`kind`); `insertExpense`; `expenseLive`; `replaceExpense` |
| `server/api.js` | `PUT /api/expenses/<id>` (the edit), with its checks and limits |
| `server/static.js`, `Dockerfile`, `.dockerignore`, `service-worker.js` | `recent-groups.js` served, shipped, cached; cache `splitsheet-v7` |
| `manifest.json` | `theme_color` `#4F46E5`, `background_color` `#FFFFFF` |
| `tests/*` | New `recent-groups.test.js`; edit, settle-up, migration, N-1, `groupName`, no-pop-ups and v7 tests (see Tests) |
| `docs/google-play/STORE_LISTING.md`, `assets/` | New (SF-015) |

## Decisions for the reviewer

- **D1 — An edit replaces the expense under a new ID; it never overwrites.** Example: two phones
  edit "Dinner" offline. The first edit to arrive wins, and the second gets 409 `gone` and a plain
  message, so Dinner is never counted twice. A lost answer's resend succeeds without a second
  copy. Cost: each edit is one more row towards the 5,000-expense and 20,000-entry limits, and the
  old version stays as a deleted row (as deletes already do). Overwriting in place would make a
  late resend silently undo someone else's newer edit.
- **D2 — A settle-up is an expense with `kind: "settlement"` and `desc: "Payment"`**, not a new
  table. Example: "Ben paid Asha ₹100" is paid by Ben, split to Asha. `money.js` needs no change,
  older pages show the same balances, and rolling back leaves a working database. A settle-up to
  a removed person is refused by the same people check as an expense.
- **D3 — F-12 is fixed in the page only** (the card's option 2). The server still creates a group
  on any `PUT /api/group`, because pages still on v6 start new groups that way; requiring a
  "create" flag would break them until they update. A v6 page can still create a group by a
  currency change on an unknown code until its worker updates (low; one empty group).
- **D4 — A group's name comes from its code** (`groupName`): "goa-trip-7k2m9xqpwd" → "Goa trip".
  The app stores no name. An old code whose last part happens to be 10 letters from the code
  alphabet would lose that word (for example "sharma-weddingday" → "Sharma").
- **D5 — "Paid by" starts on the payer of the latest ordinary expense** (by date, settle-ups
  skipped), or the first person (B4: Ben, from Deposit).
- **D6 — Sheets are native `<dialog>` elements** (focus, Escape and an inert background for
  free). Where `showModal` is missing (iOS before 15.4), the page falls back to a plain open
  dialog.
- **D7 — People's colours follow their place in the group** (reused after six), the same on every
  phone. Removing someone shifts the colours of those after them.
- **D8 — "Remove from this device" also deletes the phone's copy** of that group, but keeps its
  waiting changes, which are still sent.
- **D9 — Amounts:** the parser is unchanged (no thousands commas: "1,200" is refused with "Enter a
  number, like 250 or 99.50."; in some languages a comma is the decimal point), and amounts still
  use the phone's own number format. The card asks for the money output to stay the same.
- **D10 — Store screenshots are of the real app** (7, 1,080 × 1,920, made-up data), taken as
  inside the Android app (no "Install app" button). The design mock-ups aren't used as
  screenshots.
- **D11 — The app icon is the owner's own image (D-19, answered about 15:15 IST).** The owner
  dropped `docs/design/icon/splitfamilia-icon.png`: 1,254 × 1,254 RGB, a teal-and-green "S" on a
  rounded square with white corners. `evidence/T-04-make-icons.mjs` makes the three icons from it:
  - it finds the rounded square (edges 52–1,201 and 51–1,200, corner radius about 283 px);
  - it fills the white corners with the background (the nearest edge colour, blended over 60 px
    into a smooth quadratic fit of the gradient), so Play's and Android's own masks never show
    white;
  - it adds an 8% margin, so the whole "S" sits inside the 80% circle a maskable icon may be cut
    to (the manifest marks both icons "maskable" and "any");
  - it scales down in halving steps: `icon-512.png` (512, 265 KB), `icon-192.png` (46 KB),
    `apple-touch-icon.png` (180, 41 KB). All are 32-bit PNGs with every pixel opaque. Play asks
    for a 32-bit PNG under 1,024 KB; iOS wants no transparency.

  Example: on an Android phone whose launcher cuts icons to circles, the "S" shows whole on its
  teal background, with no white corner. No extra cache bump: the icons are in the worker's
  `SHELL`, and T-04's `splitsheet-v7` isn't live yet, so phones fetch them with v7. Cost: the
  icon's teal and green differ from the page's indigo and saffron (the welcome screen's small
  logo mark is still the design's indigo square); the owner chose this image.
- **D12 — Where the design and the criteria differ, the criteria win:**
  - the sync pill is white 14%, not 18% (AA contrast);
  - "Install app" is a row in the group menu and a text button on the welcome screen (the design
    has none; the browser-only button had to go somewhere);
  - the welcome screen keeps a short note: "Groups are kept on SplitFamilia's server. Anyone with
    a group's invite link can open it on any phone.";
  - the not-loaded card (N-8) and the "Removed person" payer option are new, for cases the design
    doesn't draw;
  - copying the invite link falls back to the browser's "Copy this link" box when the clipboard
    is refused (the only pop-up left);
  - dates use English month names in the phone's time zone ("29 Sep"), as the app's texts are
    English.

## Tests

| Check | Command | Result |
|---|---|---|
| Baseline | `npm test` on `db0580b` (working tree as found) | 180/180 |
| Unit and integration | `npm test` (Node 24.21.0) | **214/214** (+34). New: `recent-groups.test.js` (8); API (+8): the edit (difference by hand, resend, two phones, bad shapes, limits), settle-ups (full, part, edit, delete, refusals), the F-7 list with edits and settle-ups; db (+3): migration 2 on a version-1 file, `kind`, `replaceExpense`; outbox (+5); page client (+5); rules (+1); group code (+2: N-1, `groupName`); status (+1); wiring (+1: no `alert()`/`confirm()`) |
| Break checks | `node docs/planning/evidence/T-04-break-checks.mjs` | **24/24 caught**, every file restored byte for byte ([output](T-04-break-checks-output.txt)) |
| Browser check | `node docs/planning/evidence/T-04-browser-check.mjs . <scratch> <shots>` (headless Edge, local server, temporary database) | **B0–B17 as expected** (table below); no `alert`/`confirm`/`prompt`, no page errors, no CDP timeouts, no unexpected 4xx/5xx ([output](T-04-browser-check-output.json)) |
| Contrast | `node docs/planning/evidence/T-04-contrast-check.mjs .` | **33/33 pass WCAG AA** ([output](T-04-contrast-output.txt)) |
| Store screenshots | `node docs/planning/evidence/T-04-store-shots.mjs . <scratch> docs/google-play/assets/phone-screenshots` | 7 × 1,080 × 1,920, colour type 2 (RGB, no alpha) |
| Feature graphic | `python docs/planning/evidence/T-04-flatten-png.py …` | 1,024 × 500, 0 pixels not opaque, written as 24-bit RGB |
| App icons (D-19) | `node docs/planning/evidence/T-04-make-icons.mjs . <empty scratch dir>` | 512, 192 and 180 px, colour type 6 (32-bit RGBA), every pixel opaque; a preview with Play's rounded mask and Android's circle checked by eye; `npm test` 214/214 after |

**The browser check, worked by hand.** People's IDs sort Asha < Ben < Chitra, so a leftover
paisa goes to Asha.

| # | What | Expected (by hand) | Seen |
|---|---|---|---|
| B1 | Edit Dinner ₹1,200.00 (Asha, split 3) to ₹1,250.50 | Before: 40,000 each: "Ben owes Asha ₹400.00" and "Chitra owes Asha ₹400.00". After: 125,050 ÷ 3 = 41,683 r 1, so Asha's share is 41,684; Asha +83,366, Ben and Chitra −41,683 each: "₹416.83" twice. Server: the old row deleted, one new row of 125,050 | As expected; sheet "Edit expense", "1200.00", payer Asha, "everyone", Save and Delete shown |
| B2 | Offline, the same Dinner split Asha and Ben only | 62,525 each: "Ben owes Asha ₹625.25"; hint "₹625.25 each"; "offline: 1 change waiting to sync"; the row "waiting to sync"; online: "live", server split Asha+Ben | As expected |
| B3 | Delete Dinner: Cancel, then Delete | "Delete ‘Dinner’ (₹1,250.50)? \| It comes off the list for everyone in the group, and balances update."; Cancel keeps it (2 on the server); Delete leaves Deposit (Ben, for Ben): "All settled up." | As expected |
| B4 | Hotel ₹300.00, then Asha pays Ben ₹40, the rest, then ₹40 → ₹50 | Payer starts on Ben (Deposit); "₹100.00 each"; "Asha owes Ben ₹100.00", "Chitra owes Ben ₹100.00". Pay sheet 100.00 with the note; at 40 the note hides; then "Chitra owes Ben ₹100.00", "Asha owes Ben ₹60.00"; the rest is prefilled "60.00", then only "Chitra owes Ben ₹100.00". The edit to ₹50: Asha −10,000 + 5,000 + 6,000 = +1,000, Ben +20,000 − 11,000 = +9,000, Chitra −10,000: "Chitra owes Ben ₹90.00", "Chitra owes Asha ₹10.00". Server: two `[settlement]` rows of 6,000 and 5,000 | As expected; "Asha paid Ben \| 1 Oct · payment" rows |
| B5 | People: remove Asha (in expenses), remove Zed | Asha: "Can't remove someone who appears in an expense. Delete their expenses first." in place; Zed: "Remove Zed from the group? \| Their name comes off the People list for everyone in the group."; server: Asha, Ben, Chitra | As expected; with Zed in, Hotel read "split among 3" (no longer everyone) |
| B6 | Empty add form, then "12.345" | "Add a description.", "Enter an amount.", "Pick at least one person to split with."; `aria-invalid` true; the split list opens; then "Use at most 2 decimal places." | As expected |
| B7 | Diwali, Switch group, open Check trip, Switch again | Sweets ₹300 by Chitra: "Asha owes Chitra ₹100.00", "Ben owes Chitra ₹100.00". List: Diwali party 2026, Check trip ("Opened just now"); current-group key cleared; tap opens Check trip; then Check trip first | As expected |
| B8 | Remove Diwali from this device | List: Check trip only; Diwali's IndexedDB copy gone (1 copy left); the server still has Diwali | As expected |
| B9 | Two taps at once on the list (F-3) | One group opens (the first), one live stream | `check-trip…`, 1 stream |
| B10 | N-8: offline open of Lake trip, never read here | "Not loaded yet. Connect to see this group."; Add expense and + disabled; online: Tickets ₹10.01 split 2 = 500 r 1, Asha +500: "Ben owes Asha ₹5.00" | As expected |
| B11 | F-12: unknown code, offline then online | Currency field disabled, nothing queued; online "not syncing", "No group found with that code. Check it, or ask for the invite link."; no group on the server | As expected |
| B12 | F-11: Hike started offline in tab A, opened in tab B | Both "offline: 1 change waiting to sync"; A shows step 1; online both "live"; 1 create sent | As expected |
| B13 | The guide in Hike | Step 2 after 2 people; step 3 "Invite your group" (started here); copy puts the invite link (same `g`) on the clipboard and the guide goes, also after a reload and in tab B | As expected |
| B14 | 360, 390, 412, 768 px × home, menu, People, Add (split open), Pay, welcome, Start, Join | No sideways scroll; no control under 44 × 44 | All "ok", none small |
| B15 | Dates and cache | "30 Dec 2025" and "1 Oct"; only `splitsheet-v7` | As expected |
| B16 | Labels and dialogs | Every input and select labelled; `sheet` a dialog labelled by its title, `confirm` an alertdialog | 9 inputs, none missing |
| B17 | The old address (SF-038) | "moved" notice only, linking to `https://splitfamilia.up.railway.app/?g=check-trip-a9a9ijkeit` | As expected |

**Before and after at 390 px** (`evidence/T-04-screens/`):
- before (`db0580b`): `before-390-join.png`, `before-390-group-top.png`,
  `before-390-group-full.png`;
- after: `after-390-welcome-first.png`, `-your-groups`, `-home`, `-menu`, `-people`,
  `-add-expense`, `-edit`, `-confirm-delete`, `-record-payment`, `-guide-invite`, `-not-loaded`,
  `-moved`, and `after-768-home.png`.

SF-015's store shots are the same UI at 1,080 × 1,920.

**Not exercised:**
- a real phone, safe-area insets and iOS Safari. Headless Edge only; the TWA is T-05;
- screen-reader speech: checked by markup (labels, dialogs, `role="status"` on the sync text,
  `aria-live` on "Copied"), not by listening;
- the clipboard fallback box: headless Edge was given clipboard permission;
- old v6 pages against the new server: by reasoning only (D2, D3); the API answers they rely on
  are unchanged.

## Documentation

- `CLAUDE.md`: seven modules, the UI, edits and settle-ups in the database, the new
  `localStorage` key, the test list.
- `README.md`: `recent-groups.js`, the store listing and assets, the test summary, the summary
  line.
- `docs/google-play/PRODUCTION_AUDIT.md`: the T-04 paragraph (local storage, "logout", payments,
  error handling, the database).
- `docs/google-play/PLAY_CONSOLE_SETUP.md`: points to the listing draft.
- `docs/design/README.md`: the design is built, with differences here.
- `docs/planning/REVIEW.md`: invariants for edits, settle-ups and no pop-ups.
- Story cards SF-012, SF-016, SF-017, SF-018 and SF-019: "Follow-ups from T-04".

## Open limitations and follow-ups

- **D-19 is answered:** the icons are the owner's own image (D11). If the owner later wants the
  page's colours or its small logo mark to match the teal icon, that is a new small story.
- **Not deployed.** Every web change goes live only with a push to `main`, on the owner's word.
  The push carries migration 2, which runs once on Railway's database at start. Rolling back is
  safe (see SF-023).
- Each edit adds a row towards a group's limits (D1). A family never comes near 5,000; SF-024
  (deleting a group) clears them.
- A v6 page can still create a group by a currency change on an unknown code until it updates
  (D3).
- A second tab's guide follows another tab's "Copy invite link" only through the `storage`
  event, which browsers fire between tabs, not within one.
- The store listing's line numbers are for this tree; SF-021 re-checks the claims before release.
