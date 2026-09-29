# SF-001 implementation receipt — Test the balance maths without the network

- **Story:** [SF-001](../stories/SF-001.md)
- **Phase:** implementation, 2026-09-28, about 23:38–23:55 IST. The self-check here is **not**
  the fresh-session review.
- **Baseline:** `8898b50` ("Add files via upload"), on `main`, up to date with `origin/main`.
  Before this phase the only local changes were the untracked planning files (`CLAUDE.md` and
  `docs/`). Nothing was committed, pushed or deployed in this phase.
- **Review input:**
  - Diff of the tracked files: `git diff 8898b50 -- index.html service-worker.js | sha256sum`
    → `8ce4ccd462176da3cb285140bd9f44f0a6c26aa958d0bbaae455fd1483f03848` (4 insertions, 39
    deletions).
  - SHA-256 of the working-tree bytes (`sha256sum <file>`). This is a Windows checkout with
    `core.autocrlf=true`, so `index.html` and `service-worker.js` have CRLF endings on disk:

    | File | SHA-256 |
    |---|---|
    | `index.html` | `4cd79b887efd41356e5b0e485b0e2da487cb4f516ff7d0b11a3e36442fc8605a` |
    | `service-worker.js` | `d1246a59a9a489919dec3a49e25c3f581a06ae78a179b7bdf5dafc8f75faf2e6` |
    | `money.js` (new) | `037d72f97ea10f23f62f34490d68e5569448a0ea698ab7ec5996d5b32c74588f` |
    | `package.json` (new) | `88878b9f470ed28a4681b09deb064ff6b9ab1144dd73a7e2a7effbc73a395eef` |
    | `tests/money.test.js` (new) | `ea51899f578ae7967fbe2af2b4c6d1cab7a13dde621f45d2aa171c2c8727cf94` |
    | `tests/wiring.test.js` (new) | `9aa7dc81f7b3c3009bc325d6562cd76849d7ebf21e2d6d04b294dbcd562f17bd` |
    | `docs/planning/evidence/SF-001-browser-smoke.mjs` (new, evidence only) | `56ddf5941d31ca1b10663d9940e4bc478d535d7640ab0bf23ef7399e53c84acd` |

  - `CLAUDE.md` also changed (the Stack and Tests lines). It is an untracked planning file, so it
    is not hashed here.

## What it does, in one example

Nothing changes on screen. Asha pays ₹300 for dinner, split between Asha, Ben and Chitra. Before
and after this change the Balances section says "Ben owes Asha ₹100.00" and "Chitra owes Asha
₹100.00". Now `npm test` proves it in about 0.2 seconds, with no network and no Firestore.

## Changes

| File | What changed |
|---|---|
| `money.js` (new) | `computeBalances(people, expenses)` and `simplifyDebts(balances)`, moved unchanged from `index.html`. The only change: `people` and `expenses` are now parameters instead of closure variables. No DOM, no Firebase, no module state. |
| `index.html` | Imports both functions from `./money.js`, deletes the two in-page copies, and calls `simplifyDebts(computeBalances(people, expenses))` in `renderBalances()`. |
| `service-worker.js` | `CACHE` goes from `splitsheet-v2` to `splitsheet-v3`, and `./money.js` is added to `SHELL`. |
| `package.json` (new) | `"private": true`, `"type": "module"`, no dependencies. Its one script is `"test": "node --test \"tests/*.test.js\""`. |
| `tests/money.test.js` (new) | 9 characterisation tests. |
| `tests/wiring.test.js` (new) | 2 tests: the page imports from `./money.js` and no longer defines the functions, and the service worker caches `./money.js`. |
| `CLAUDE.md` | The Stack line lists `money.js`. The Tests line gives the command and the Node version. |
| `docs/planning/evidence/SF-001-browser-smoke.mjs` (new) | The browser harness used below, kept so the reviewer can re-run it. It is not part of the app or of `npm test`. |

## Decisions for the reviewer

- **D1: behaviour is copied exactly, floats included.** The page still divides in floating point
  and uses the same ±0.005 "settled" threshold. For example, ₹100 split three ways still shows
  "Ben owes Asha ₹33.33" and "Chitra owes Asha ₹33.33" (₹66.66 in total, one paisa short). The
  tests pin this on purpose: SF-004 changes it and flips those expectations. Cost: the tests
  currently protect known-imperfect behaviour.
- **D2: the test script is `node --test "tests/*.test.js"`, not `node --test tests/`.** On Node
  24.21 a bare directory fails with `MODULE_NOT_FOUND` (seen in this session). Node expands the
  quoted glob itself, so the same command works in cmd.exe, PowerShell and sh. Cost: it needs
  Node 21 or later, the first version with glob support in `--test`. CLAUDE.md says Node 22 or
  later; only 24.21 was run.
- **D3: `"type": "module"` in package.json.** This way Node loads `money.js` as the same ES
  module the browser loads, with no warning and no second copy. Cost: any future `.js` script
  that Node runs in this repo is ESM by default. The browser ignores package.json, so
  `service-worker.js` is unaffected.
- **D4: the wiring tests match text.** They fail if someone puts the functions back inline or
  drops `./money.js` from the cache list. Cost: reformatting the import line breaks the test
  even when the behaviour is fine.
- **D5: the browser check is evidence, not a test.** It needs Edge or Chrome and a local server,
  so it stays outside `npm test`.

## Tests

| Check | Command | Result |
|---|---|---|
| Unit and wiring tests | `npm test` | **11 passed, 0 failed**, exit 0 (Node 24.21.0). There is no `node_modules` and no `package-lock.json`, so nothing was installed. |
| Break check (story requirement) | Change `exp.amount / exp.split.length` to `exp.amount / (exp.split.length + 1)` in `money.js`, run `npm test`, then restore | **4 tests failed** (even split, two expenses, missing split member, odd split). After the restore, `money.js` has the SHA-256 above, byte-identical to before the break. |
| Screen unchanged (real browser) | The harness in headless Edge. It swaps the gstatic Firebase modules for fakes holding fixed data and blocks Firestore hosts, so no real data is touched. It renders 4 groups on the original files (`git archive 8898b50`) and on the new files | **All 4 identical** before and after, with **0 page errors**. Balances shown: ₹300 dinner → "Ben owes Asha ₹100.00", "Chitra owes Asha ₹100.00". ₹90 taxi plus ₹30 tea → "Chitra owes Asha ₹45.00", "Ben owes Asha ₹15.00". ₹100 three ways → ₹33.33 each. Removed member → "Ben owes Asha ₹100.00". |
| Installed copy upgrades (v2 → v3) | On one origin: serve the original files, open them, swap in the new files, open again, then open a third time (same browser profile) | Rendering is identical at every step. On the 2nd open, `splitsheet-v3` exists and holds `/money.js`, and `splitsheet-v2` is still present. On the 3rd open **only `splitsheet-v3` remains**, holding `/money.js`. |
| Saved harness still works | Re-run `docs/planning/evidence/SF-001-browser-smoke.mjs` against the final tree | Identical to the baseline in all 4 groups. Cache `splitsheet-v3` holds `money.js`. 0 errors. |

Not exercised:

- the real Firestore, by design;
- a real phone or an installed PWA (Android Chrome, iOS Safari);
- opening the app offline;
- Chrome (only Edge was run) and Node versions other than 24.21;
- adding or deleting people and expenses in the browser. That code did not change, and the
  fakes reject writes.

## Documentation

CLAUDE.md: the Stack line now lists `money.js`, and the Tests line gives `npm test` and its Node
version. README.md is two lines of description with no run or test instructions, so it is
unchanged. The story card is unchanged: cards hold no status.

## Open limitations and follow-ups

- **Known money flaws, pinned for now → SF-004:** shares are floats (₹100 / 3 shows 33.33 +
  33.33), and a removed split member's share vanishes (₹300 split A/B/removed C leaves the
  balances summing to +₹100).
- **Inferred from reading the code, not tested:** an expense with an empty `split` gives
  `share = Infinity`. Nobody is debited, and the payer is credited the full amount. The add form
  blocks an empty split, but a stored document could still have one. → SF-004 should decide and
  test this.
- **Upgrade window, inferred:** while the old v2 worker is still in control, it serves the new
  `index.html` and fetches `money.js` from the network. If a phone went offline after getting
  the new page but before v3 finished installing, the import would fail. The simulation above
  showed v3 installing on the next online open. → SF-008 (offline start), which also covers the
  Firebase CDN modules, which the service worker never caches.
- **Hosting → SF-011:** `package.json`, `tests/` and `docs/` sit next to `index.html`.
  `python -m http.server` serves them, and a naive static host would too. None is secret, but
  the Railway image should copy only the app files. Railway can also auto-detect
  `package.json` as a Node app, which the planned Dockerfile avoids.
