# Production audit baseline

This records, for every item in stage 1 of the owner's brief
([brief](../planning/brief/2026-09-28-google-play-release-brief.md)), what the app does today, the
evidence, and which story fixes it or why the item doesn't apply. SF-003 wrote it on 2026-09-29
(IST). SF-021 repeats the audit before release and adds its results here.

**Where the line numbers point.** Every `file:line` below refers to commit **`8898b50`**, the last
commit before the Play release work began. Check one with, for example,
`git show 8898b50:index.html | sed -n 472p`. Stories in T-02 and later change these files, so
today's line numbers differ; the commit reference never moves.

**Progress since the baseline.** T-02 (reviewed, accepted) fixed the SF-004 and SF-005 rows.
T-03 (reviewed and accepted 2026-09-30; live on GitHub Pages and Railway since
2026-09-29) addresses the SF-007 to SF-011 rows:

- `firestore.rules` (15 of 15 emulator tests pass). They were never deployed, and T-09 removed
  them with the rest of Firebase: the switch-over makes Firestore read-only, then the owner
  deletes the project ([MOVE_FROM_FIREBASE.md](MOVE_FROM_FIREBASE.md));
- offline start and a start-up failure panel;
- honest sync status and plain error messages. A delete not yet confirmed isn't counted (T-03
  review F-5, fixed in SF-022);
- the SplitFamilia name;
- Railway hosting ([HOSTING_RAILWAY.md](HOSTING_RAILWAY.md)).

T-08 (reviewed and accepted 2026-09-30; deployed on Railway as `a8bffb8` the same day) changes
three rows below. SF-021 must re-check each:
- **"No own backend", "Production CORS: Not applicable" and "Environment variables":** the app
  now has its own server with a ledger API (`server/`). The page doesn't call it until T-09.
  - The API sends no CORS headers, so only the app's own pages can use it from a browser; a
    test checks this.
  - The server reads `PORT`, `RAILWAY_VOLUME_MOUNT_PATH` and `RAILWAY_ENVIRONMENT_NAME` (or
    `RAILWAY_ENVIRONMENT`). None of them is a secret.
- **Database configuration:** a SQLite database on a Railway volume, which the owner creates
  (HOSTING_RAILWAY.md section 3a). The API applies the same limits the Firestore rules did.

T-09 (implemented 2026-09-30; not yet reviewed or switched over) changes these for SF-021:
- **Firebase:** the page loads no Firebase SDK and holds no Firebase config or key; the repo has
  no rules, `firebase.json` or Firebase dependency (`npm test` checks). The only other site the
  page contacts is Google Fonts (until SF-025).
- **Environment variables:** `IMPORT_TOKEN` is a secret, set in Railway only for the move and
  removed after it (MOVE_FROM_FIREBASE.md steps 2 and 6). It is never committed or logged.
- **Local storage:** the phone keeps a copy of its group and its waiting changes in IndexedDB
  (`outbox.js`); `localStorage` still holds only the current group's code.

T-04 (implemented 2026-10-01 IST; not yet reviewed or deployed) changes these for SF-021:
- **Local storage and "Logout":** `localStorage` also keeps "Your groups"
  (`splitfamilia-recent`, `recent-groups.js`): up to 20 group codes opened on this phone, each
  with its last-opened time. "Switch group" no longer forgets the group; it goes back to that
  list. "Remove from this device" takes one group off the list and deletes the phone's copy of
  it; the group on the server is untouched. The Data safety answers (SF-016) and the privacy
  policy (SF-017) must say so.
- **Payments:** a settle-up ("Ben paid Asha ₹100") only records a payment made outside the app
  (an expense marked `kind: "settlement"`); the app never moves money (SF-016's financial
  features answer).
- **Error handling:** form checks are shown under their fields; the page has no `alert()` left.
  The only pop-up is the browser's own "Copy this link" box, if copying to the clipboard fails.
- **Database:** migration 2 adds the `kind` column. An edit marks the old expense deleted and
  adds the new one, so each edit counts towards the 5,000-expense and 20,000-entry limits.

A row counts as fixed only once its task is reviewed and deployed. SF-021 re-checks every row.

Statuses:

- **OK**: nothing to fix.
- **Fixed by SF-xxx**: a planned story fixes it. The story card holds the acceptance criteria.
- **Not applicable**: the app has no such feature; the evidence says how that was checked.
- **MANUAL ACTION REQUIRED** / **OWNER CONFIRMATION REQUIRED**: only the owner can do or decide it.

## What the app is

- One static page (`index.html`) with an inline `<script type="module">`, a manifest and a
  service worker. No build step and no server code of its own.
- Data lives in Cloud Firestore (project `splitfamilia-cf927`), through the Firebase JS SDK
  12.17.1 loaded from `https://www.gstatic.com` (`index.html:465`, `:469`).
- No sign-in. Whoever knows a group's code can read and change that group
  (`index.html:552-554` build the Firestore paths from the code alone).
- There is no Android project yet (no `android/`, no Gradle files in the tree or in history).

## Findings, item by item

### Configuration, URLs and secrets

| Brief item | Finding | Evidence | Status |
|---|---|---|---|
| Debug/development configuration | No debug flags, no emulator config, no `localhost`. One stale comment ("Fill these in from Firebase Console") sits above a config that is already filled in. | `git grep -nE 'debug\|DEBUG\|localhost\|127\.0\.0\.1\|emulator' 8898b50` → no matches. Comment: `index.html:464`. | OK |
| Production API/base URLs | No own backend. The app talks to Firestore through the SDK, to Google Fonts, and to the gstatic CDN. | `index.html:15-17` (fonts), `:465`, `:469` (SDK), `:471-478` (Firebase config). | OK |
| HTTP vs HTTPS | Every external URL is `https://`. No `http://` anywhere. The site itself must be served over HTTPS; that is SF-011 (Railway). | `git grep -n 'http://' 8898b50` → no matches. | OK in code. Hosting: fixed by SF-011 |
| Environment variables | Not used: a static page with no build step. The Firebase web config is written into the page by design. | `git grep -nE 'process\.env\|import\.meta\.env' 8898b50` → no matches. | Not applicable (SF-011's server reads only `$PORT`) |
| Hardcoded secrets | None found. The full history scan is below. | See "Secret scan". | OK |
| API keys | One Firebase **web** API key. Firebase says keys "restricted to Firebase services do not need to be treated as secrets"; data is protected by Security Rules and App Check, "not by keeping your Firebase API key secret" ([Firebase: API keys](https://firebase.google.com/docs/projects/api-keys), checked 2026-09-29 IST). It stays in the code. | `index.html:472`. | Public by design. **MANUAL ACTION REQUIRED:** in Google Cloud Console → APIs & Services → Credentials, confirm the key is limited to Firebase APIs, and, once the Railway domain exists, add HTTP-referrer restrictions for it and `localhost` ([HOSTING_RAILWAY.md](HOSTING_RAILWAY.md), section 7). |
| Firebase configuration | Firestore with a persistent local cache (IndexedDB) shared across tabs. No Auth, Analytics, Messaging or App Check SDK is loaded. | `index.html:471-483`. | OK. App Check: SF-026 (stretch) |
| Database configuration | **No Firestore security rules in the repo.** The owner reports none were written and there is no test-mode expiry (D-6, 2026-09-28), so the database is probably open to anyone with the project ID. | `git ls-files` at `8898b50` has no `firestore.rules` or `firebase.json`. | Fixed by SF-007 (the owner deploys the rules) |
| Production CORS | No own API, so nothing to configure. Firestore and Google Fonts handle CORS themselves. | No server code in the tree. | Not applicable |

### Accounts and stored data

| Brief item | Finding | Evidence | Status |
|---|---|---|---|
| Authentication configuration | No sign-in. Nothing imports Firebase Auth. | `git grep -nE 'firebase-auth\|getAuth\|signIn' 8898b50` → no matches. | Not applicable |
| Authentication expiration | No sessions or tokens to expire. | As above. | Not applicable |
| Logout | No accounts. The nearest equivalent is "Switch group", which forgets the saved group on this device. | `index.html:521-526`. | Not applicable |
| Secure storage of auth tokens | No tokens. `localStorage` holds only the current group's code (`splitsheet-group`). That code works like a password for the group, but it is not a credential of an account. Firestore also keeps a copy of the group's data in IndexedDB on the device. | `index.html:494`, `:497`, `:515`, `:522`; cache `:482`. | Not applicable. The on-device copy goes in the Data safety answers (SF-016). |
| Guessable groups | Anyone who types the same group name, such as `goa-trip-2026`, lands in the same group and can read and change it. | `index.html:486-488` (`slugify`), `:508-519` (join). | Fixed by SF-006 |

### Errors, failures and loading

| Brief item | Finding | Evidence | Status |
|---|---|---|---|
| Error handling | Users see raw Firebase error text, for example `Couldn't save: ` + `e.message`, and `· sync error: ` + `err.message`. | `index.html:776`, `:785`, `:795`, `:799`, `:814`; `:848`, `:854`, `:860`. | Fixed by SF-009 |
| Crash handling | No global `error` or `unhandledrejection` handler. Two known crashes: an invalid invite link (next row) and an Infinity amount that freezes the page (`simplifyDebts` loops forever; found in the SF-001 review). | `git grep -nE 'onerror\|unhandledrejection' 8898b50` → no matches. Loop: `index.html:728-735`. | Global handler: SF-009. Infinity freeze: fixed by SF-004 |
| App startup failures | 1. An invalid `?g=` value (for example `goa/trip`) is saved to `localStorage` and passed to Firestore, where the `/` makes `doc()` throw, on every launch. 2. The Firebase SDK is never cached, so the app can't start offline, and a failed CDN load leaves a blank page. | 1: `index.html:490-498`, `:552`. 2: `service-worker.js:28` skips every cross-origin request. | 1: fixed by SF-005. 2: fixed by SF-008 |
| Network failures | Firestore's offline cache keeps reads and queues writes, but nothing tells the user they are offline. | `index.html:482`; status text `:838-842`. | Fixed by SF-009 |
| Backend availability failures | If Firestore can't be reached, the status still says "· live" after the first snapshot, even when it came from the cache. | `index.html:838-842`. | Fixed by SF-009 |
| Loading states | "connecting…" shows until the first snapshot arrives. | `index.html:398`. | OK for now; SF-009 makes it honest |
| Logging | No `console` calls at all. | `git grep -n 'console\.' 8898b50` → no matches. | OK |
| Debug logging of sensitive data | Nothing is logged. | As above. | OK. SF-009 allows at most `console.error` with an error code. |

### Money

| Brief item | Finding | Evidence | Status |
|---|---|---|---|
| Balance calculations (brief stages 1 and 7) | Shares are floating-point (`amount / split.length`), and a 0.005 tolerance hides the rounding. ₹100 split three ways shows ₹33.33 + ₹33.33, a paisa short. A removed split member's share vanishes. The amount comes from `parseFloat` with no upper limit. | `index.html:708`, `:721-722`, `:733-734`, `:820`. | Fixed by SF-004 |

### Analytics, crash reporting and push

| Brief item | Finding | Evidence | Status |
|---|---|---|---|
| Analytics | None. No `measurementId` in the config, no Analytics SDK, no `gtag`. | `git grep -niE 'analytics\|gtag\|measurementId' 8898b50` → no matches. | Not applicable |
| Crashlytics / error reporting | None. | `git grep -niE 'crashlytics\|sentry\|bugsnag' 8898b50` → no matches. | Not applicable |
| Push notifications | None. `messagingSenderId` is only a standard field of the Firebase config; nothing imports Messaging or uses the Notification API. | `index.html:476`; `git grep -nE 'firebase-messaging\|Notification\|PushManager' 8898b50` → no matches. | Not applicable. SF-012 keeps TWA notification delegation off. |

### Android and the store

| Brief item | Finding | Evidence | Status |
|---|---|---|---|
| Android project | None exists. | No `android/`, `build.gradle` or `AndroidManifest.xml` in the tree or in history. | Fixed by SF-012 and SF-013 |
| Android permissions / unnecessary permissions | Nothing to audit until the project exists. Expected: `INTERNET` only. | As above. | Fixed by SF-012 (checks the merged manifest); SF-021 re-checks |
| Application / package ID | None yet. Decided: `com.splitfamilia.app` (D-1). | STATE `open_decisions` D-1. | Fixed by SF-012 |
| Application name | The app calls itself "Splitsheet". Decided: SplitFamilia (D-2). | `index.html:6`, `:14`, `:375`, `:391`; `manifest.json:2-3`. | Fixed by SF-010 |
| Install instructions | Every user, Android included, sees "On iPhone/iPad: open in Safari, tap Share…". | `index.html:458`. | Fixed by SF-010 |
| App icon | The same `icon-192.png` and `icon-512.png` are declared both `maskable` and `any`. The artwork is not padded for the maskable safe zone (a circle of 40% of the width around the centre): in `icon-512.png` the paper's top corners sit about 234 px from the centre and the red seal reaches about 250 px, against a safe radius of about 205 px, so launchers crop them. | `manifest.json:13-16`; measured by eye from the 512 px image. | Fixed by SF-012 (a padded maskable icon). Store icon: SF-015 |
| Splash screen | For the PWA the browser builds one from the manifest (`background_color`, icon). The Android splash does not exist yet. | `manifest.json:10-11`. | Fixed by SF-012 |
| Android version configuration, versionCode/versionName | None yet. | No Android project. | Fixed by SF-012 (versionCode 1, versionName 1.0.0) |
| Google Play target API requirement | None yet. SF-012 checks the official requirement page when it builds and records the date. | No Android project. | Fixed by SF-012 |
| minSdk | None yet. | No Android project. | Fixed by SF-012 |
| Release build configuration | None yet. | No Android project. | Fixed by SF-013 |
| ProGuard / R8 | None yet. | No Android project. | Fixed by SF-013 (R8 on, with a launch check) |

### Repository hygiene

| Brief item | Finding | Evidence | Status |
|---|---|---|---|
| Exposed secrets | None. The only key-like value is the Firebase web API key above. | "Secret scan" below. | OK |
| `.gitignore` | There was none. SF-003 adds one for signing keys, local credentials, build outputs, Firebase logs and editor files. | `.gitignore`; checks below. | Fixed by SF-003 |
| Files a static host would expose | `package.json`, `tests/` and `docs/` sit next to `index.html`, so a naive static host serves them too. None is secret. | Working tree. | Fixed by SF-011 (the Docker image copies only the app files) |

## Secret scan (2026-09-29, IST)

The repository has **4 commits**, all on 2026-09-04 (IST): `79dd013`, `24fe7f6`, `7e75927`,
`8898b50`. Every file ever committed: `README.md`, `apple-touch-icon.png`, `icon-192.png`,
`icon-512.png`, `index.html`, `manifest.json`, `service-worker.js`.

Commands, run in Git Bash from the repository root:

```sh
# 1. Every path ever committed, and any that look like keys or credentials
git log --all --name-only --pretty=format: | sort -u
git log --all --name-only --pretty=format: \
  | grep -iE '\.(jks|keystore|p12|pem|key|pfx)$|\.env|service.?account|google-services|credentials|keystore\.properties|key\.properties'

# 2. Secret patterns in every commit's text files
P='BEGIN [A-Z ]*PRIVATE KEY|"private_key"|"type": *"service_account"|client_secret|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|xox[abprs]-|password|passwd|secret|bearer|token|storePassword|keyPassword'
git grep -nIiE -e "$P" $(git rev-list --all)

# 3. PEM private keys inside binary files too
git grep -naE -e 'BEGIN [A-Z ]*PRIVATE KEY' $(git rev-list --all) | wc -l

# 4. The working tree, including files not yet committed
grep -rIciE --exclude-dir=.git -e "$P" . | grep -v ':0$'
grep -rnoIE --exclude-dir=.git 'AIza[0-9A-Za-z_-]{35}' .
find . -path ./.git -prune -o -type f \( -iname '*.jks' -o -iname '*.keystore' -o -iname '*.p12' \
  -o -iname '*.pem' -o -iname '*.pfx' -o -iname '.env*' -o -iname '*service-account*' \
  -o -iname 'google-services.json' -o -iname '*.properties' \) -print
```

Results:

1. Seven paths, listed above. No key, keystore, `.env`, service-account or properties file has
   ever been committed.
2. **One match in history:** `8898b50:index.html:472`, the Firebase web API key (public by
   design, see "API keys" above). The two earlier versions of `index.html` (`24fe7f6`,
   `7e75927`) kept data only in `localStorage` and had no Firebase config.
3. `0`: no PEM private key in any file, binary or text.
4. Working tree: the same Firebase key (at `index.html:473` when the scan ran, before T-02's code
   changes) and no key-like files. The other
   hits are the words "password", "secret" and "token" in planning docs and this guide, and no
   line assigns a value to them (`grep -rnIiE '(password|secret|token)[a-z_]*\s*[:=]\s*["'\''][^"'\'' ]{6,}' .`
   → no matches).

No real secret was found, so nothing needs rotating and history needs no rewrite.

## `.gitignore` checks (2026-09-29, IST)

```text
$ git check-ignore -v --no-index android/upload-keystore.jks android/keystore.properties \
    .env.production android/app/build/x.aab
.gitignore:5:*.jks	android/upload-keystore.jks
.gitignore:12:keystore.properties	android/keystore.properties
.gitignore:19:.env.*	.env.production
.gitignore:29:build/	android/app/build/x.aab

$ git ls-files -ci --exclude-standard
(no output: no tracked file is ignored)
```

`.env.example` is deliberately **not** ignored (`!.env.example`), so a placeholder-only example
can be committed. The app files, `docs/`, `tests/` and `package.json` are not ignored.

## Owner actions from this audit

- **MANUAL ACTION REQUIRED:** check the Firebase web API key's restrictions in Google Cloud
  Console (Firebase APIs only), and add an HTTP-referrer restriction for the Railway domain once
  it exists ([HOSTING_RAILWAY.md](HOSTING_RAILWAY.md), section 7).
- **MANUAL ACTION REQUIRED:** deploy the Firestore rules from SF-007 when they are ready. Until
  then the database is probably open.
