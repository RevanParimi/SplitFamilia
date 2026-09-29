# SF-001 review receipt — Test the balance maths without the network

- **Story:** [SF-001](../stories/SF-001.md). Implementation receipt:
  [SF-001-implementation.md](SF-001-implementation.md).
- **Review context:** a fresh-session review in a new conversation, 2026-09-29, finished about
  03:35 IST (start time not recorded). This session did not write any of the reviewed code.
- **Reviewed input:** verified, **yes**. Nothing drifted from the receipt.
  - `git diff 8898b50 -- index.html service-worker.js | sha256sum` →
    `8ce4ccd462176da3cb285140bd9f44f0a6c26aa958d0bbaae455fd1483f03848` (4 insertions, 39
    deletions), matching the receipt.
  - The SHA-256s of `index.html`, `service-worker.js`, `money.js`, `package.json`,
    `tests/money.test.js`, `tests/wiring.test.js` and `evidence/SF-001-browser-smoke.mjs` all
    match the receipt's table.
  - Working tree at review time: the tracked `index.html` and `service-worker.js` are modified.
    `CLAUDE.md`, `docs/`, `money.js`, `package.json` and `tests/` are untracked. Nothing was
    committed. The review changed no app file.
- **Verdict:** `accepted`.

## Contract checked and adversarial examples

Expected values were worked out by hand from the story, not taken from the code.

| # | Input | Expected (by the contract, worked out by hand) | Observed |
|---|---|---|---|
| 1 | Asha pays ₹300, split A/B/C | 300/3 = 100 each: A +200, B −100, C −100. Screen: "Ben owes Asha ₹100.00", "Chitra owes Asha ₹100.00" | Test passes. Headless Edge shows exactly those two lines, the same on the baseline and the new files |
| 2 | A pays ₹90 split A/B/C, then B pays ₹30 split B/C | A 90−30 = +60; B −30+30−15 = −15; C −30−15 = −45. Largest debtor first: C→A 45, B→A 15 | Test passes. Edge shows "Chitra owes Asha ₹45.00", "Ben owes Asha ₹15.00" on both versions |
| 3 | ₹100 split three ways (odd amount) | **Unchanged** float behaviour: 33.33 + 33.33 shown, one paisa short (SF-004 fixes this) | The same on both versions, pinned by a test on purpose |
| 4 | A removed member in a split, and an expense paid by a removed member | Unchanged: the missing member's share vanishes, and the removed payer's expense is skipped | "Ben owes Asha ₹100.00" on both versions, pinned by two tests |
| 5 | 20,000 generated groups (0–6 people, 0–5 expenses), 6,139 of them hostile: string, `null`, NaN, negative and huge amounts; missing or empty splits; IDs like `constructor`, `__proto__` or `"0"` | `money.js` returns exactly what the baseline's inline functions returned, for every input: the same values, the same key order, and the same thrown errors | **0 mismatches.** 872 inputs throw the same error in both. 454 inputs with ±Infinity balances were compared only up to `computeBalances`, because `simplifyDebts` never returns on them in either version (F-1). The same harness run on a copy with the creditor sort reversed shows 291 mismatches, so the comparison does catch real changes |
| 6 | The site is unreachable after one online visit (the server is stopped, and `fetch` fails) | The app still opens, as it did before SF-001: `money.js` comes from the `splitsheet-v3` cache | Both versions open with the origin down, show the same balances, and log 0 page errors. The v3 cache holds `/money.js` |

## Findings

**In the reviewed change: none found.** The moved functions are character-for-character the
baseline code. The only differences are the `export` keyword and the two new parameters, and a
mechanical diff of the extracted bodies confirmed it. There is one call site (`index.html`
line 713), and it passes the page's live `people` and `expenses` arrays.

Found during the review, **present before SF-001 and unchanged by it.** SF-001 has to keep
today's behaviour exactly, so they do not block it. They go to later stories:

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-1 | **Medium** (high impact, low likelihood) | `money.js` `simplifyDebts()`, the `while` loop (lines 33–40); also `index.html` line 789, the amount check | A balance of ±Infinity. Pay = min(∞, ∞) = ∞, then ∞ − ∞ = NaN, so neither index ever advances. **Observed:** the loop never ends, and memory grows until the tab crashes. Node hit its heap limit on both the baseline and `money.js`. **Expected:** it returns. **Reachable from the real form:** headless Edge accepts `1e308` in the amount field (`checkValidity()` is true), and two such expenses by one payer overflow to Infinity. With those two expenses stored, the page stopped answering within 4 s. `1e309` is rejected by the browser. A direct database write of `amount: Infinity` does the same | Every phone that opens that group freezes. Nobody can delete the bad expense from inside the app, because the page is frozen, so recovery needs the Firebase console. Today the database is open (D-6), so anyone who knows a group's name can do this | → **SF-004** (added to its card: a read-time guard, and `simplifyDebts` must always end) and **SF-007** (its `amount` ≤ 10,000,000 rule blocks new writes; it cannot fix documents already stored) |
| F-2 | Low | `money.js` `computeBalances()`, `exp.paidBy in balances` and `pid in balances` (lines 10 and 14) | `in` also sees the built-in `Object` names. An expense paid by a missing person with ID `"constructor"` (or `toString`, `valueOf`, …) is **not** skipped. **Observed:** with Chitra paying ₹90 split three ways, plus that expense of ₹60 split Asha/Ben, the screen shows "Asha owes Chitra ₹60.00". **Expected**, as for any other missing payer: "Asha owes Chitra ₹30.00" and "Ben owes Chitra ₹30.00" | Wrong balances, but only after a direct database write, because the app itself writes only random Firestore IDs | → **SF-004** (added to its card: own-property checks, `Object.hasOwn` or a `Map`) |
| O-1 | Note (inferred, not re-tested) | `service-worker.js` fetch handler | The v2→v3 upgrade window described in the implementation receipt: if an old v2 worker has saved the new `index.html` but v3 has not finished installing, an offline open cannot load `money.js` | A one-time blank start while offline, during the upgrade only | Stays with **SF-008**, as the implementation receipt says |

Reproductions:

- **F-1:** `node --input-type=module -e 'import { computeBalances, simplifyDebts } from "./money.js"; simplifyDebts(computeBalances([{id:"a"},{id:"b"}], [{amount:1e308,paidBy:"a",split:["b"]},{amount:1e308,paidBy:"a",split:["b"]}]))'`
  never returns. Run it with `--max-old-space-size=256`, and stop it within seconds.
- **F-2:** `computeBalances([{id:"asha"},{id:"ben"},{id:"chitra"}], [{amount:90,paidBy:"chitra",split:["asha","ben","chitra"]},{amount:60,paidBy:"constructor",split:["asha","ben"]}])`,
  then `simplifyDebts` gives `[{from:"asha",to:"chitra",amount:60}]`. With `paidBy: "gone-member"`
  instead, it gives ₹30 from Asha and ₹30 from Ben.

## Commands and results

All runs were on this machine (Windows 11, Node v24.21.0, Microsoft Edge headless), 2026-09-29
IST.

| Check | Command | Result |
|---|---|---|
| Input verification | `git diff 8898b50 -- index.html service-worker.js \| sha256sum`; `sha256sum` on the 7 files | All match the receipt |
| Full suite | `npm test` | **11 passed, 0 failed**, exit 0, about 0.18 s. No `node_modules` and no `package-lock.json` |
| Break checks (reviewer's own, on a scratch copy; the working tree was never edited) | 7 mutations, each followed by `node --test "tests/*.test.js"` | Every mutation made at least one test fail: settled threshold 0.005→0.02 (1 failed); removed missing-payer guard (2); debtors sorted ascending (1); removed missing-member guard (1); payer not credited (4); `./money.js` removed from the SW cache list (1); inline `computeBalances` put back in the page (1). The working-tree hashes were unchanged afterwards |
| Behaviour identical to the baseline | A scratch script: the baseline functions extracted from `git show 8898b50:index.html`, compared with `money.js` on 20,000 seeded random inputs | 0 mismatches (see row 5 above). A deliberately mutated copy: 291 mismatches |
| Screen unchanged (real browser) | `evidence/SF-001-browser-smoke.mjs` against `git archive 8898b50` (port 8765) and the working tree (port 8766), fresh scratch profiles | All 4 groups **identical**, 0 page errors on both. Baseline cache `splitsheet-v2`; new cache `splitsheet-v3` with `/money.js`. No Firestore request was made |
| Opens with the site unreachable | A scratch variant of the harness: open once online, open again (now under the service worker), stop the server, confirm `fetch` fails, then open again | Both versions render the same balances with 0 errors. The new version serves `money.js` from `splitsheet-v3` |
| F-1 in the real form | A scratch variant of the harness: type `1e309`, `1e308` and `100000000000000000000` into the amount field; then open a fake group holding two ₹1e308 expenses | `1e309`: empty value, form invalid. `1e308` and 10²⁰: accepted, form valid. The page with two ₹1e308 expenses did not answer within 4 s. The probe browser was closed afterwards |

Every browser check used the harness's fake Firebase modules and blocked the Firestore hosts, so
no real data was read or written. The scratch scripts and profiles live in the session
scratchpad, outside the repo.

Not exercised:

- the real Firestore, by design;
- a real phone or an installed PWA;
- Chrome (only Edge was run) and Node versions other than 24.21;
- the v2→v3 upgrade window itself (O-1);
- adding or deleting people and expenses in the browser. That code is unchanged, and the fakes
  reject writes.

## Acceptance checklist

| Criterion | Verdict |
|---|---|
| `money.js` exports `computeBalances(people, expenses)` and `simplifyDebts(balances)` as pure functions: no DOM, no Firebase, no module-level state | **Met.** It imports nothing and keeps no top-level variables. The freeze test and repeat calls agree |
| `index.html` imports them from `./money.js`, and the people, ledger and balances it shows are unchanged | **Met.** Line 470, and the browser comparison was identical in 4 groups |
| `npm test` runs `node --test` over `tests/` with no install and no network; `package.json` has no dependencies | **Met.** The tests import only `node:*` modules and `../money.js`. There is no `dependencies` key |
| Characterisation tests pin today's behaviour, including a missing payer (skipped) and a missing split member (ignored) | **Met.** Both are tested, and the missing-member test is marked "SF-004 changes this" |
| `service-worker.js` caches `./money.js`, and the cache is `splitsheet-v3` | **Met.** Seen in the file and in the browser caches |
| The CLAUDE.md "Tests" line names the new command | **Met.** It gives `npm test`, `node --test "tests/*.test.js"` and the Node version |
| Required tests: the ₹300 and ₹90 + ₹30 examples, no people or no expenses, a break check | **Met.** Hand-checked above; the break checks were repeated by the reviewer |

## Decision and follow-up state

- **accepted**, for the revision with the hashes above.
- STATE.json changes: SF-001 `status` → `done`; `review_receipt` → `evidence/SF-001-review.md`;
  one `review_outcomes` entry (2026-09-29, accepted, F-1, F-2 and O-1);
  `production_verification` → `pending_deployment`; `active_task` → none; `next_task` →
  SF-002; `next_phase` → implementation; a `history` line.
- SF-004's card gains a "Follow-ups from the SF-001 review" section, with F-1, F-2 and the empty
  `split` case from the implementation receipt.
- **Production verification:** `pending_deployment`. SF-001 ships with the next push to `main`,
  which is a production deploy (D-5), so it needs the owner's word. After that deploy, the check
  is: open an existing group on the live site, confirm the balances show as before, and confirm
  the service worker's cache is `splitsheet-v3` and holds `money.js`. **SF-011 note:** its
  Dockerfile must copy `money.js` along with the other app files.
