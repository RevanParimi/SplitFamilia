# Google Play readiness report

The report the owner's brief asks for at the end ("Final response"), written by SF-021 (task T-06)
on 2026-10-02 (IST), after the final repository audit. It states what is done and verified, and
what is still outstanding. **Status of this report's own task:** T-06 is done. Its first review
asked for one change (F-16: the policy's time for IP addresses in the server's memory); the
rework made it, and a second fresh review accepted it on 2026-10-02 (about 08:15 IST). Nothing
from T-06 is committed, pushed or deployed yet.

## Changes Made

Everything the release work changed since the brief (2026-09-28), by task. Each task has an
implementation and a review receipt in `docs/planning/evidence/`.

| Task | Files and configuration |
|---|---|
| T-01 | `money.js` (balance maths) and its tests |
| T-02 | Exact-paise money (`money.js`), safe group links (`group-code.js`, random codes for new groups), `.gitignore` for keys and secrets, `PLAY_CONSOLE_SETUP.md`, `PRODUCTION_AUDIT.md` (baseline) |
| T-03 | Offline start and a start-up failure panel, honest sync status and plain errors (`sync-status.js`), the name SplitFamilia, the hosting files (`Dockerfile`, `.dockerignore`, `railway.json`, `.well-known/assetlinks.json`) |
| T-08 | The app's own server (`server/`: Node 24, SQLite on a Railway volume, the ledger API, live updates, limits in `ledger-rules.js`) |
| T-09 | The page on that server (`ledger-client.js`, `outbox.js` for offline changes), the data copied from Firebase (`scripts/move-from-firestore.mjs`), Firebase removed from the repository |
| T-04 | Editing expenses, settle-ups, "Your groups" (`recent-groups.js`), the new UI (`index.html`), the store listing and graphics (`STORE_LISTING.md`, `assets/`) |
| T-05 | The Android app (`android/`, a Trusted Web Activity: `com.splitfamilia.app`, 1 / "1.0.0", target API 36, no permissions), release signing from the owner's key only (`android/app/release.gradle`), `BUILD_RELEASE.md`, `ANDROID_APPROACH.md`, `PLAY_CONSOLE_DECLARATIONS.md`, `REVIEWER_ACCESS.md`, `tests/android.test.js` |
| T-06 | `PRIVACY_POLICY.md` and `privacy.html` (linked from the welcome screen and the group menu, cached offline; `server/static.js`, `Dockerfile`, `.dockerignore`, `railway.json`, `service-worker.js` cache `splitsheet-v8`); the message bar now shows above an open sheet (`index.html`, the T-04 review's F-14 and N-14); `RELEASE_TESTING.md`; `PRODUCTION_RELEASE_CHECKLIST.md`; the final audit in `PRODUCTION_AUDIT.md`; this report; `android/app/src/main/res/raw/keep.xml` and an `android/.gitattributes` line (the T-05 review's F-15 and N-18); `tests/privacy.test.js` and new wiring checks; in the rework, the server forgets IP addresses on a timer, as the policy says (`server/api.js`, `server/server.js`, the T-06 review's F-16) |

## Build Status

**A signed `app-release.aab` for upload was not produced, by design.** It must be signed with the
owner's own upload key, which no session creates or holds.

- **The blocker:** the upload key doesn't exist yet. **MANUAL ACTION REQUIRED:** create it
  ([BUILD_RELEASE.md](BUILD_RELEASE.md) section 3), point the build at it (section 4), then, in a
  clone outside OneDrive:

  ```powershell
  cd android
  .\gradlew.bat clean lintRelease bundleRelease
  ```

  The bundle is then `android\app\build\outputs\bundle\release\app-release.aab`; check it with
  section 8.
- **What this session proved (2026-10-02, about 02:20 IST):** from a clean clone of `5f51b22` plus
  T-06's changes, outside OneDrive, `gradlew clean lintRelease bundleRelease` ended in
  **BUILD SUCCESSFUL**, signed with a **throwaway** key made in the scratchpad and deleted
  afterwards. That bundle (2,133,421 bytes) is not for upload and was deleted with the build
  folder. Transcripts: `docs/planning/evidence/T-06-build-transcripts.txt`.

## Tests

All run in this session (2026-10-02 IST), with their outputs in `docs/planning/evidence/`:

| Check | Result |
|---|---|
| `npm test` (Node 24.21.0; no install, no network) | **230 / 230 pass** after T-06's rework (226 / 226 before it, in the working tree and in the clean clone) |
| Android lint (`lintRelease`) | **0 errors**, 14 warnings (Bubblewrap template; one fewer than T-05, since the kept manifest is no longer "unused") |
| `bundleRelease` (throwaway key) | **BUILD SUCCESSFUL** |
| `jarsigner -verify` | `jar verified.` (signed by the throwaway key) |
| `bundletool validate` | passes |
| `bundletool dump manifest` | `com.splitfamilia.app`, versionCode 1, versionName 1.0.0, minSdk 21, targetSdk 36; only AndroidX's private signature permission; no `debuggable`, `testOnly` or cleartext attribute |
| `T-05-android-checks.mjs` on that bundle | **17 / 17 pass** (permissions, cleartext, link filter, colours, versions, R8) |
| F-15 (the Chrome OS manifest) | fixed: `raw/web_app_manifest` is a reachable resource and `base/res/raw/web_app_manifest.json` is in the bundle |
| N-18 (`twa-manifest.json` line endings) | fixed: checked out with LF, its SHA-1 matches `manifest-checksum.txt` |
| Browser dry run of RELEASE_TESTING.md (headless Edge, local server, 360 px) | every expected text and balance matched after one fix to the guide (M14); the message bar is on top, readable and dismissable above a sheet and a confirmation; the privacy page opens from both links and offline |
| T-04's browser check B0–B17, re-run | unchanged except today's date and the cache name (v8) |
| The deletion steps (PRIVACY_POLICY.md section C) on a local database | the group's rows all gone, the API 404 for it, another group untouched |
| Release checklist against the brief | 37 / 37 boxes, word for word, in order |
| T-06 break checks | 20 / 20 wrong edits caught by the tests (13, then 7 more in the rework); T-08's 20 server break checks re-run in the rework: 20 / 20 |
| Final audit and the codes check | see Security Findings |

Not run: the app on a real phone or emulator (D-20: the first real launch is the owner's own
phone from internal testing), and the Docker image itself (no Docker on this machine; Railway
builds it).

## Security Findings

1. **A real family group code is in the public repository (escalated: D-21).** One of the
   family's group codes, an old-style code made from a group's name, is used as an example in a
   test under `tests/`, in every commit since `6f3b3fe` (2026-09-29). The repository is public on
   GitHub, and GitHub Pages serves `tests/` too until PC-008. Anyone who reads it can open that
   group and change it. **D-21, answered:** the example is now a made-up code in the tree;
   history keeps the old one (accepted, as D-4 accepts guessable old-style codes). Starting a new
   group with a random code stays your option.
2. **`assetlinks.json` still has placeholders.** The app works but shows an address bar until the
   owner's upload key fingerprint and Play's app signing fingerprints are in and deployed. A
   release blocker.
3. **Railway's HTTP logs** keep each request's IP address, user agent and path for 30 days, and
   the first open of an invite link puts the group's code in the path. The privacy policy says
   so; `#g=` links (SF-035, owner's choice) would keep codes out.
4. **Old-style group codes are guessable** (accepted in D-4). New groups get random codes; the
   server blocks an address after 30 unknown codes in 10 minutes.
5. **Google Fonts** receives every visitor's IP address until SF-025 (stretch) serves the fonts
   from the app's own server. The privacy page itself loads nothing from Google.
6. **The old Firebase web API key** is in history (public by design); it stops working when the
   Firebase project is deleted at PC-008.
7. **Deleted and edited entries stay in the database** (marked deleted) until the whole group is
   deleted, and deleting a group is a manual step for the owner (`railway ssh`; SF-024 would
   add it to the app). The privacy policy says so.
8. No real secret, key, keystore, password, token, service credential or debug flag was found in
   the tree or in any commit, and nothing shipped mentions localhost, plain `http://` or
   Firebase.

## Play Console Manual Actions

All **MANUAL ACTION REQUIRED**, by the owner; a session never uploads or changes anything there.

1. Create and verify the personal developer account, pay the fee, verify a device
   ([PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md)).
2. Create the app: SplitFamilia, App, Free.
3. Main store listing: the texts, the icon, the feature graphic and seven screenshots
   ([STORE_LISTING.md](STORE_LISTING.md)); category; support email and website.
4. App content: privacy policy URL (`https://splitfamilia.up.railway.app/privacy.html`, once
   live), Data safety, App access, Ads, Content rating, Target audience, Financial features,
   Health, Advertising ID, News, Government, COVID-19
   ([PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md)).
5. Upload the bundle signed with your upload key to **internal testing**; test on your own phone
   ([RELEASE_TESTING.md](RELEASE_TESTING.md)); read the pre-launch report.
6. Copy every app signing key fingerprint from Play app signing for `assetlinks.json`
   ([BUILD_RELEASE.md](BUILD_RELEASE.md) section 9).
7. **Closed testing:** at least 12 testers opted in for 14 continuous days (VERIFY IN PLAY
   CONSOLE), then apply for production access.
8. Production release: countries, pricing (Free), release notes, then **Send for review**, after
   every box in [PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md).

Outside Play Console, also the owner's: create the upload key; PC-008 (GitHub Pages off and the
Firebase project deleted, on or after 2026-10-08 00:35 IST); the word for each push (every push
to `main` is a production deploy).

## Owner Confirmation Required

1. The privacy policy: its placeholders (name, contact email, effective date, jurisdiction,
   response time) and every LEGAL/OWNER item ([PRIVACY_POLICY.md](PRIVACY_POLICY.md) section F),
   then approval, so the "Draft" note can come off (PC-010).
2. The support email address itself (store, policy, IARC); a dedicated one, not your personal one.
3. The store category (Finance recommended) and the countries to release in.
4. `#g=` invite links (SF-035), to keep codes out of Railway's logs.
5. The data region the policy names (Railway's Southeast Asia, Singapore).

**Confirmed on 2026-10-02 (IST), "All recommended":** the ten declaration answers
([PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md) section 15): deletion requests by
email, IP addresses not declared, the group code not a User ID, retention as listed, "users
interact" Yes, 18 and over, no financial features, no demo link for now, fonts not self-hosted
for now. The policy now says 18 and over and "kept until we delete it at someone's request".

## Ready / Not Ready

**Not ready to submit yet.** The repository side is complete except the items marked
outstanding; the rest is the owner's.

**Complete and verified (repository):**

- The web app is live on Railway with its own server; Firebase is out of the code; HTTPS only.
- The Android project builds, lints with 0 errors, and produces a bundle that passes every check
  (17/17), with no permissions, R8 on, the Chrome OS manifest kept, and signing only from the
  owner's key.
- `versionCode` 1 / `versionName` "1.0.0", target API 36 (Play's requirement since 2026-08-31).
- No secrets in the tree or history; the one private-data finding (D-21) is fixed in the tree.
- The privacy policy is drafted, published as a page in the app (not yet deployed), and
  cross-checked with the declarations; the account-deletion rule doesn't apply (no accounts).
- The store listing, graphics, declarations, reviewer instructions, testing guide and release
  checklist are written from the code.
- 230 automated tests pass.

**Outstanding:**

| Item | Who | Blocks |
|---|---|---|
| Commit and push T-06 (accepted by its fresh review; a production deploy: the privacy page, the message bar fix, the server's address sweep), then PC-011 | the owner's word, then a session | everything below that needs the live page |
| The privacy policy approved, placeholders filled, "Draft" removed, deployed (PC-010) | owner, then a session and a push | Play's privacy policy URL |
| The upload key, then the signed bundle | owner | every upload |
| `assetlinks.json` with the real fingerprints, deployed | owner gives them; a session edits; a push | the app opening full screen |
| PC-008: GitHub Pages off, Firebase project deleted (from 2026-10-08 00:35 IST) | owner | the checklist's Firebase item |
| Internal testing on the owner's phone (first real launch) | owner | — |
| Closed test, 12 testers for 14 days, then production access | owner | production |
| Every Play Console form and the listing | owner | submission |
