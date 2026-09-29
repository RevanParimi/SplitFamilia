# SplitFamilia — working instructions

## The project today

- A shared-expense ledger for a family trip ("Splitsheet"): track who paid what and who owes whom.
- **Stack:** one static page, `index.html` (HTML, CSS, a small classic start-up script and a
  `<script type="module">`), plus three modules of pure functions, `money.js` (the balance
  maths, in whole paise), `group-code.js` (checking group codes, making new ones, reading invite
  links) and `sync-status.js` (the sync status and plain error messages), `manifest.json` and
  `service-worker.js` (a PWA; its cache is named `splitsheet-vN`, the page imports the modules
  as `./name.js?v=N` with the same N, and it also keeps the two versioned Firebase SDK files so
  the app starts offline). No build step.
- **Hosting files (SF-011):** `Dockerfile` (Caddy on Alpine, only the app's files),
  `.dockerignore`, `Caddyfile`, `railway.json` and `.well-known/assetlinks.json`. A new file the
  page needs must be added to the `Dockerfile` and `.dockerignore` too; `npm test` checks. Owner
  steps: `docs/google-play/HOSTING_RAILWAY.md`.
- **Firestore rules (SF-007):** `firestore.rules` and `firebase.json`; owner steps in
  `docs/google-play/FIRESTORE_RULES.md`. The rules repeat the app's limits (`npm test` checks).
- **Data:** Firebase Firestore, loaded from the gstatic CDN. Money is stored as a decimal
  `amount` in rupees and read as integer paise. The browser's `localStorage` keeps only the
  current group (`splitsheet-group`). A group can also come from the URL (`?g=<code>`).
- **Run it:** `python -m http.server 8000` in this folder, then open http://localhost:8000. A
  service worker needs `http://localhost` or HTTPS, not `file://`.
- **Tests:** `npm test`, which runs `node --test "tests/*.test.js"`. It needs Node 22 or later
  (run on Node 24.21), and no `npm install`, network or Firestore. `tests/money.test.js` covers
  `money.js`, `tests/group-code.test.js` covers `group-code.js`, `tests/sync-status.test.js`
  covers `sync-status.js`, `tests/service-worker.test.js` runs the real worker against a fake
  cache and network, and `tests/wiring.test.js` checks the page's imports against the service
  worker, the `Dockerfile` and the Firestore rules.
- **Rules tests:** `npm run test:rules` runs `tests/rules/` on the Firestore emulator (project
  `demo-splitfamilia`). It needs `npm install` and Java 21.
- **Owner's time zone:** IST (UTC+05:30). Write every date and time with its zone.
- **Current goal (from 2026-09-28):** release on Google Play as **SplitFamilia**
  (`com.splitfamilia.app`). The owner's brief is saved verbatim in
  `docs/planning/brief/2026-09-28-google-play-release-brief.md`.
  - There is no Android project yet. SF-012 wraps the hosted PWA in a Trusted Web Activity.
  - The web app will be hosted on **Railway**, like `../StockAgent-main` (SF-011's files are
    ready; the owner creates the service). Until then, production is GitHub Pages
    (`https://revanparimi.github.io/SplitFamilia/`), which a push to `main` also deploys.
- **Product direction:** ship with good features and a good-looking UI, then keep improving after
  the Play release. Aim for solid, not high-end. Because the app is a TWA, web deploys update the
  Android app without a new Play upload.

## Planning, memory and the "continue" protocol

Follow this for the life of the project. The repository holds all memory of the work; chat
history does not.

### 1. The files that hold the project's memory

- `CLAUDE.md` (this file) is loaded automatically in every session.
- `docs/planning/STATE.json` is the single source of truth for status:
  - `active_task`, `next_task`, `next_phase` (planning | implementation | review);
  - `plan_status`: `awaiting_owner_approval` or `approved`. Implement nothing while it is
    `awaiting_owner_approval`;
  - `status_definitions`;
  - `open_decisions[]`: questions only the owner can answer, each with id (`D-n`), question,
    needed_by (story IDs), status (open | answered), answer, answered_at. A task whose
    `needs_decisions` include an open decision is `blocked` with that reason, and work moves on
    to the next ready task;
  - `tasks[]`: id (`T-nn`), title, stories (the `SF-nnn` cards it covers, in order), priority,
    points, scope (planned | stretch), status, depends_on (task IDs), needs_decisions,
    implementation_receipt, review_receipt, review_outcomes[] (date, verdict, findings),
    production_verification {status, evidence}, blocked_reason, and an optional note;
  - `pending_checks[]`: time-bound follow-ups, each with id, story, due time with its zone,
    status, exact steps, pass rule, and where to record the result;
  - `history[]`: dated one-line events, newest first.
- `docs/planning/HANDOFF.md` is the resume note. It opens with "START HERE", the numbered steps
  for the next session, then a short record of the last session. Rewrite it at the end of every
  session.
- `docs/planning/stories/<SF-nnn>.md` holds one card per story, from `templates/story.md`, with
  its acceptance criteria and the task it belongs to. Cards hold no status; status lives only
  in STATE.json, per task.
- `docs/planning/evidence/<T-nn>-implementation.md` and `<T-nn>-review.md` are the receipts, one
  pair per task, with a section per story. They come from the templates in
  `docs/planning/templates/`. T-01's receipts keep their older names, `SF-001-*.md`.
- `docs/planning/REVIEW.md` is the review checklist, including this app's invariants.

### 2. Creating the stories (the `planning` phase)

- Break the owner's goals into small stories (1–3 points each). Give each story an ID
  (`SF-001`, `SF-002`, …), a priority (P0–P2), its dependencies and testable acceptance
  criteria.
- Group about **five stories into one task** (`T-01`, `T-02`, …; about 8–12 points). The owner
  found single stories too small, at about 10 minutes of work each (2026-09-29). A task is the
  unit that is implemented in one conversation and reviewed in the next. Put a story that needs
  a manual owner step (such as a live domain) at the end of a task, so the owner can do the
  step before the task that needs it.
- Order `tasks[]` in the order to do them, and mark nice-to-haves `stretch`.
- Read the current `index.html` first, so the stories start from what exists.
- Show the owner the list, then **wait for their OK before implementing anything.**

### 3. What "continue" means

When the owner says "continue":

1. Read HANDOFF.md and STATE.json, and run `git status`. Never rely on chat memory. Leave
   changes you did not make alone.
2. Run any `pending_checks` that are due and not yet recorded. Record the results.
3. Resume the active task if it is in progress, has changes requested, or awaits review.
   Otherwise take the first `todo` task in STATE order whose dependencies are all `done`.
   - Skip `stretch` tasks unless the owner promoted them.
   - Skip a task as `blocked` only with a concrete, recorded reason.
4. Before editing, set `active_task` and the task's status in STATE.json.
5. Do **one phase per conversation**:
   - **implementation:** every story of the task in its listed order, with code, tests and a
     self-check for each, ending at `review_required`. If a story is blocked partway, record
     why in `blocked_reason`, finish only the stories that don't depend on it, and tell the
     owner;
   - **review:** a fresh conversation reviews the previous one's work. A self-check in the same
     conversation never counts as the review.
6. At the end of the phase, update STATE.json, HANDOFF.md and the task's receipt together.
   Then tell the owner in plain language:
   - what changed, with one concrete example;
   - what's next;
   - anything that needs their decision.
   Do not start the next task in the same conversation.

If the owner gives a specific instruction, it wins. Record the change of order in STATE
`history`.

### 4. Status rules

- The flow is `todo` → `in_progress` → `review_required` → `done`, or → `changes_requested` →
  back to `in_progress`.
- `done` means a fresh review accepted the work with its tests passing. Code existing, or a
  Firestore write succeeding, is not `done`.
- Deployment is tracked separately, in `production_verification`: `not_started`,
  `pending_deployment`, `pending_observation`, `verified` or `failed`.
- The implementation receipt records:
  - the baseline commit;
  - the changed files with their hashes, or a diff digest, so the reviewer can verify the same
    input;
  - the exact test commands and results;
  - the docs updated;
  - the decisions made, each with an example;
  - open limitations.

### 5. Permissions and safety

- **Only on the owner's explicit word, each time:** commit, push, deploy, change Firebase
  settings or security rules, migrate or delete data, or send messages.
- **Deploy rules (D-5, answered 2026-09-28):** a push to `main` deploys to production through
  Railway auto-deploy. The owner sets up and configures the Railway service. No times to avoid
  were given. So every push is a production deploy, and it needs the owner's word.
- **Deploying includes** web hosting, Firestore rules or indexes, and Firebase console settings
  such as App Check enforcement or API-key restrictions. Each needs the owner's word first.
- **Google Play publishing** (from the owner's brief of 2026-09-28):
  - Never upload, publish or submit anything to Google Play, and never change Play Console
    settings. The owner does every Play Console action. The repo only prepares for them.
  - The finish line is the repository, the docs, the release configuration and a signed
    `app-release.aab`, all ready for the owner to review. Stop there.
  - In every doc, keep what the code does separate from what the owner must do by hand. Label
    owner steps **MANUAL ACTION REQUIRED**, account-dependent facts **VERIFY IN PLAY CONSOLE**,
    and anything the code can't settle **OWNER CONFIRMATION REQUIRED**. Never guess a compliance
    answer.
- **Signing keys and secrets:**
  - Never create the owner's real upload key.
  - Never commit a keystore (`*.jks`, `*.keystore`), key passwords, `keystore.properties`,
    `.env` files, service-account JSON or any production secret.
  - Release signing reads its credentials from environment variables or a git-ignored local
    file.
  - To prove the signing path works, a throwaway key may be made in the session scratchpad,
    outside the repo, and deleted afterwards.
- **Builds and tests:** never claim a build or test passed unless it ran successfully in that
  session.
- **Scope:** don't rewrite the app. Prefer the smallest production-safe change, and keep every
  working feature.
- **Large downloads** (a JDK, the Android SDK, emulator images) need the owner's OK first.
- **Never** print secrets or private family data in output, commits or docs. The Firebase web
  config is public by design; its security rules are what protect the data.
- **Tests** never touch the real Firestore. Use pure functions, or the Firebase emulator.
- **Bump the service-worker cache name** whenever cached files change, or phones keep the old
  version. Bump the `?v=` on the page's module imports (and in the worker's `SHELL`) to the same
  number; `npm test` fails until they agree. A new Firebase SDK version changes the page's
  imports and the worker's `SDK` list together (also checked).

### 6. Keeping the memory accurate

- Update the docs a story affects in the same phase.
- Edit STATE.json surgically, never by regenerating the whole file. Another session may be
  editing it, so re-read it just before you write.
- Write each pending check's pass rule against how the code actually behaves, not how you
  assume it behaves.
- If a plan file is missing or contradicts another, say so. Never invent completion history.
- Use your own memory only for facts that are not in the repo (environment quirks, the owner's
  preferences). The repo files are always authoritative for status.
