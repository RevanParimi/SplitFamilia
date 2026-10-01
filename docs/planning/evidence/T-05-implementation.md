# T-05 implementation receipt — The Android app, its signed release build, the build guide and the Play declarations

- **Task:** T-05. Stories, in order: [SF-012](../stories/SF-012.md), [SF-013](../stories/SF-013.md),
  [SF-014](../stories/SF-014.md), [SF-016](../stories/SF-016.md).
- **Phase:** implementation, 2026-10-01, about 19:15–21:40 IST, on the owner's "continue" (and
  "try now" after a pause around 20:30 IST). The self-check here is **not** the fresh-session
  review.
- **Baseline:** `cc489a5` (T-04, live on Railway). `npm test` on it: 214/214. The working tree
  already held the previous session's uncommitted record updates (`STATE.json`, `HANDOFF.md`,
  `PRODUCTION_AUDIT.md`'s T-04 line, `evidence/T-04-pc009-output.txt`); this phase edited
  `STATE.json`, `HANDOFF.md` and `PRODUCTION_AUDIT.md` again. Nothing was committed, staged or
  pushed. No web file (page, modules, worker, manifest, icons, server, Dockerfile) changed, so
  nothing here needs a deploy.
- **Decisions used:** D-0 (TWA with Bubblewrap), D-1 (`com.splitfamilia.app`), D-2
  (SplitFamilia), D-8 (install the JDK and the Android SDK), D-10 (the Railway address), D-19
  (the owner's icon).
- **Tools installed (D-8), outside the repo:** Android command-line tools (build 16111833, SHA-1
  checked against Google's repository index), `platform-tools` 37.0.1, `platforms;android-36`,
  `build-tools` 36.1.0 and 35.0.0 in `%LOCALAPPDATA%\Android\Sdk` (about 600 MB); bundletool
  1.18.3 in `%LOCALAPPDATA%\Android\bundletool`; Gradle 8.11.1 and the libraries in
  `%USERPROFILE%\.gradle` (about 750 MB); `@bubblewrap/cli` 1.25.0 in the session scratchpad
  only. Installing the SDK packages accepted the Android SDK licence, as Bubblewrap's own
  installer asks. The JDK (Temurin 21.0.12.1) was already installed by the owner (D-11).
- **Review input:** SHA-256 of each new or changed file as on disk (all LF, except
  `android/gradlew.bat`, which is CRLF as Bubblewrap writes it). Recompute with
  `sha256sum <file>`. `STATE.json`, `HANDOFF.md` and this receipt change at the end of the phase
  and are not listed. The `android/` tree (40 files) as a whole:
  `find android -type f | LC_ALL=C sort | xargs -d '\n' sha256sum | sha256sum` →
  `f1fae0f5353dabe1827b4eaf87cb04abea7ba4b44f9a3b7d4e9392b9e4b5105c` (run it before any build
  inside `android/`, or exclude `build/` and `.gradle/`).

| File | SHA-256 |
|---|---|
| `android/twa-manifest.json` (new) | `ede49623f2b188552ad033ac2f437d9bf2a8c36f16790932bc2ce743482cbab3` |
| `android/app/build.gradle` (new; Bubblewrap's, plus the `apply from` line) | `c12429a4c6d1b4ba0b49e4b8972530ed2a231aaf65eae80f2060f7b1cd054ff8` |
| `android/app/release.gradle` (new, ours) | `34f6d4937499bbcc17e7a6f6f04c2147a856b9a07ea2d058e7f4badb5dc1da4c` |
| `android/keystore.properties.example` (new, ours) | `3074cb83c6a73cf7f9f6c6fc7070601d4085e2408997da43d624d85426cba607` |
| `android/.gitattributes` (new, ours) | `92ab9476e45538c2cc443e7e013c062f587e28726c13c3a9f046abda8fc45a7b` |
| `android/app/src/main/res/xml/shortcuts.xml` (as the build writes it) | `09e0c1798ab467d1018ae01b3c44c657c5dbfeb8edd6fcf588bc875613866101` |
| `android/app/src/main/AndroidManifest.xml` (Bubblewrap's) | `02364becee00bfb54cc074b140168dd9fed7044476eaa4e0cbd476c0b5c0dd73` |
| `tests/android.test.js` (new) | `9a755c5191729eb5a19173fbd81ab064c80b3c627c5bf9cf5766f39d61edd617` |
| `tests/wiring.test.js` | `81e7361cc718bc97cc1095d6a01fd243af904423d1b1255438314e67b3492965` |
| `docs/google-play/ANDROID_APPROACH.md` (new) | `3cd64dee139472acf695a1f5c756fc7e8f0222383cbc9275b4908fec06491da7` |
| `docs/google-play/BUILD_RELEASE.md` (new) | `32deb106987d1a551d1754d9c5a328a8f198d77ec4b45c18e7e543ab62a646e3` |
| `docs/google-play/PLAY_CONSOLE_DECLARATIONS.md` (new) | `37bf8943b9686f189409fa5cbee16c78b28336ce4f21fec6de07e6a4a12b3db1` |
| `docs/google-play/REVIEWER_ACCESS.md` (new) | `fd0c6dfc14158eec237b3c37c46aac69c8c2bda6622b5ed5a796ff335d910046` |
| `docs/google-play/HOSTING_RAILWAY.md` | `6137111fc3f5af02cbd1037e467ec603d1937009f4dfad20513811f32db9e2f1` |
| `docs/google-play/PLAY_CONSOLE_SETUP.md` | `4bd11e5337413f886abf789bda7a7e8a8f85b3fde06384d6fe5f330bae363837` |
| `docs/google-play/PRODUCTION_AUDIT.md` | `e65746dd41cd95149b2e2e64e19fda4aea62352610173f99fc893417c6b38fd2` |
| `README.md` | `d144e60af83536757c1e27e3c58fbefb2f10c696c2346d024238ca8ddeb0f918` |
| `CLAUDE.md` | `5c207a1f650ab811f8b3dc1c446aa1d8b3817d96dc8ff0af98a5c786e9da3880` |
| `docs/planning/stories/SF-017.md` | `28abf5da78c532ea356031d2023223ca0d0d3a2010ae16df3b660e56df3d0803` |
| `docs/planning/stories/SF-018.md` | `bacbb1e150b87ec52b76d040cb8d028a9e0f07d4db4d87b5c69f87d12975f14f` |
| `docs/planning/stories/SF-019.md` (D-20's answer added 23:38 IST) | `e661e0b3bb3a0b90b813dee38f99b320881c12386b5b349daef8955fffaf2272` |
| `docs/planning/stories/SF-021.md` | `566b35f349df67bf8d612fa0175e31149fd20df0b4f3cd6bf054956443bb8b8d` |
| `docs/planning/evidence/T-05-android-checks.mjs` (new) | `6ad1f28272b8486234b9d035640c422e5ab8f5f7f6a50025ec6e217dd9508860` |
| `docs/planning/evidence/T-05-break-checks.mjs` (new) | `1fc0b76aaaf58b58e089ec045f93b5cd2da331d8861a8986b63bc1d06601f6ba` |
| `docs/planning/evidence/T-05-break-checks-output.txt` (new) | `84b0d7fd6355891dd75945e5bd349dc349e3ec83bfe76f1965782cdb1f86cfe3` |
| `docs/planning/evidence/T-05-build-transcripts.txt` (new) | `64122dc6c65dfc7d96a788199fc2030744dbc5a628523c90245c6117de168352` |
| `docs/planning/evidence/T-05-icon-mask-check.html` (new) | `58b5799d9cb38a4a126dd326ee6967885ae479ea6c380760c60c468a2bf5620b` |
| `docs/planning/evidence/T-05-icon-mask-check.png` (new) | `f3f9d88b3437f9f71557c10e825cbadd48f6ac18e86498e91d4231ea7e858707` |
| `docs/planning/evidence/T-04-pc009-output.txt` (the previous session's, untouched) | `23dfe7109b2dbc8732e45a7c7826882a17f1af819069f85e61aadc9fdad575e3` |

## What it does, in one example per story

- **SF-012:** before, SplitFamilia existed only as a website you could "install". Now `android/`
  builds an Android app called SplitFamilia that opens https://splitfamilia.up.railway.app full
  screen with an indigo status bar, and a tapped invite link
  (`https://splitfamilia.up.railway.app/?g=…`) can open in the app. It asks for no Android
  permission at all.
- **SF-013:** `gradlew bundleRelease` makes `app-release.aab` signed with the owner's upload key,
  read from four `SPLITFAMILIA_UPLOAD_*` variables or the git-ignored
  `android/keystore.properties`. Without them it stops: "SplitFamilia release signing: no upload
  key: set the SPLITFAMILIA_UPLOAD_* environment variables, or copy
  android/keystore.properties.example …". It never signs a release with the debug key.
- **SF-014:** the owner can follow `docs/google-play/BUILD_RELEASE.md` from installing the tools
  to a verified `.aab`; every command in it was run here from a clean clone, in PowerShell and in
  bash.
- **SF-016:** for Play's "Financial features" form the owner has a prepared answer, "My app
  doesn't provide any financial features", with the code that shows it (a settle-up only records
  a payment made outside the app), and every answer the code can't settle is marked OWNER
  CONFIRMATION REQUIRED.

## Per-story status

| Story | Done? | Acceptance criteria met | Notes |
|---|---|---|---|
| SF-012 | Yes | All but the device launch (no emulator or device; see below) | Colours follow T-04's design; no separate maskable icon needed (D3); no permissions at all (D4) |
| SF-013 | Yes | All; the "launch check" for R8 is a static check of the DEX (D11) | Throwaway key made in the scratchpad and deleted |
| SF-014 | Yes | All; two commands not run as typed (password prompts) and one no-op skipped, each recorded | Found and fixed one problem (shortcuts.xml, D8) |
| SF-016 | Yes | All | Ten owner confirmations listed in its section 15 |

## SF-012 — Android app project (Trusted Web Activity)

| Criterion | Result | Evidence |
|---|---|---|
| `android/` generated by Bubblewrap, with `twa-manifest.json`; approach, reasons and risks in `ANDROID_APPROACH.md` (TWA support and Custom Tab fallback, Play's minimum-functionality policy) | Met | `@bubblewrap/cli` 1.25.0, `bubblewrap update --skipVersionUpgrade` from a `twa-manifest.json` built with Bubblewrap's own `TwaManifest.fromWebManifest` on the live manifest (D1). Policies quoted with links, checked 2026-10-01 IST |
| `applicationId` `com.splitfamilia.app`, label SplitFamilia, versionCode 1, versionName "1.0.0", host the Railway domain | Met | Checks V1–V3, B1 (transcripts C, G); `tests/android.test.js` |
| `targetSdk` = Play's requirement, checked on the official page with the date; `compileSdk` ≥ it; `minSdk` Bubblewrap's default | Met: 36, 36, 21 | [Target API level requirements](https://developer.android.com/google/play/requirements/target-sdk), checked 2026-10-01 IST: "Starting August 31 2026: New apps and app updates must target Android 16 (API level 36) or higher". Check B2 |
| Merged release manifest: no permission beyond `INTERNET`; no `POST_NOTIFICATIONS`, location, billing or `AD_ID`; checked on the merged manifest | Met, and stricter: **no permission at all** (D4) | Checks M1–M3 on `merged_manifests/release/…/AndroidManifest.xml`, B3 on the bundle (bundletool). Only AndroidX's app-private `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (signature) |
| Cleartext not allowed | Met | Check M4: no `usesCleartextTraffic="true"`, no network security config, targetSdk 36 (off by default). Railway also redirects http to https (301) |
| Adaptive icon with the artwork in the safe zone; padded maskable icon; SW cache bump if the manifest changes | Met without a new file (D3) | `T-05-icon-mask-check.png`: the "S" inside the 80% circle (A) and inside the circle (B) and rounded-square (C) masks. No manifest change, so no cache bump |
| Splash `#F6F4EF`, bars `#2F5D50` | Replaced by T-04's follow-up: splash `#FFFFFF`, status bar `#4F46E5`, navigation bar `#FFFFFF` (D2) | Check V4 |
| Intent filter for `https://<host>` with `autoVerify` | Met (every path) | Check M5 |
| `./gradlew assembleDebug` succeeds; if a device is available, install and open | Build: met (scratch copy, transcript A; clean clones, transcripts H and I). Device: **not run**: no device or emulator here; an emulator image needs the owner's OK (CLAUDE.md §5) | — |
| Transcripts of `assembleDebug` and the merged-manifest check; a visual check of the icon under a circle mask | Met | Transcripts A, C, H, I; `T-05-icon-mask-check.png` |

## SF-013 — Signed release build

| Criterion | Result | Evidence |
|---|---|---|
| Release: `minifyEnabled true`, `shrinkResources true`; R8 keeps what androidbrowserhelper needs | Met | `app/release.gradle`; checks D1–D4: all 9 classes the manifest names are in the bundle's DEX; `LauncherActivity` still extends androidbrowserhelper's (renamed `J.h` by R8, mapped back through `mapping.txt`); `TwaLauncher` kept |
| `signingConfig` reads the four `SPLITFAMILIA_UPLOAD_*` variables, otherwise `android/keystore.properties` | Met (D5) | Transcript A: signed from the variables; signed from `keystore.properties`; transcript G: both, in PowerShell |
| `keystore.properties.example` committed with placeholders only | Met | `tests/android.test.js` checks it holds only `<…>` placeholders and `keyAlias=upload` |
| No credentials: `bundleRelease` fails with a clear message, never the debug key | Met | Transcript A: three negative runs (none; only one variable; the file without `keyPassword`), each "BUILD FAILED" with its message and no bundle written; `tests/android.test.js` and break check K9 |
| `bundleRelease` makes `android/app/build/outputs/bundle/release/app-release.aab` | Met | 2,132,864 bytes (scratch copy), 2,133,630 bytes (clean clone) |
| Throwaway key with `keytool` in the scratchpad, deleted afterwards | Met | RSA 2048 (transcript A) and RSA 4096 (transcript F) keys, random passwords never printed; both keys, their password files and every scratch clone deleted at about 21:30 IST (`find` found 0 key files afterwards) |
| `jarsigner -verify -verbose -certs` shows the throwaway certificate; `bundletool validate` passes; `bundletool dump manifest` shows the package, versionCode 1, targetSdk 36 and the expected permissions | Met | Transcripts B and G: "jar verified.", signed by the throwaway certificate; validate exit 0; dump as stated. jarsigner's warnings are expected (self-signed, no timestamp, and JDK 21's JarInputStream note on the Android Gradle plugin's bundle layout) |
| `./gradlew lint` on release; errors fixed or recorded | Met: **0 errors**, 15 warnings (release), 17 (debug, `./gradlew lint`) | Transcript D; all warnings come from Bubblewrap's template: 5 × IconLauncherShape (full-square legacy icons, by design: D-19), MonochromeLauncherIcon (no themed icon), SourceLockedOrientationActivity (portrait, from the web manifest), UnusedAttribute (`autoVerify` below API 23), 7 × UnusedResources (template resources) |
| `git status` and `git ls-files` show no keystore, properties file, `.aab` or `.apk` | Met | Repo: `git ls-files` and `git status --porcelain --untracked-files=all` list none (21:3x IST). Clone: `keystore.properties`, `build/` and `.gradle/` show as ignored (`!!`, transcript G) |

## SF-014 — Release build guide, run end to end

`docs/google-play/BUILD_RELEASE.md`: prerequisites with versions and how to get each (section
1), the clone (2), creating the upload key, MANUAL ACTION REQUIRED (3), pointing the build at it
(4), clean / install / tests / lint (5), build (6), where the `.aab` is (7), verifying it (8),
the fingerprints for `assetlinks.json` incl. Play App Signing (9), the `versionCode` rule and
where to change it (10), troubleshooting (11).

**The clean-clone run.** The work isn't committed, so: `git clone` of the repository (at
`cc489a5`) into the scratchpad, the working tree's 55 changed and new files copied over it and
committed **inside that scratch clone only** (identity "T-05 scratch clone", never in the
repository, never pushed), then `git clone` of that clone. So the run used a real checkout,
`core.autocrlf=true` and `.gitattributes` included.

| Guide step | Run | Result |
|---|---|---|
| 1. SDK install (PowerShell, as written, into a throwaway SDK folder) | Yes | 277 s; only `platform-tools`, `platforms/android-36`, `build-tools/35.0.0` (transcript E). `[Environment]::SetEnvironmentVariable(ANDROID_HOME …)` **not run**: it would change the owner's user environment; `ANDROID_HOME` was set per session instead |
| 1. bundletool download | Yes | Same SHA-256 as the first download (`a099cfa1…`) |
| 2. Clone | Yes (bash, from the scratch copy) | Transcripts H, I: `gradlew` LF, `gradlew.bat` CRLF after checkout |
| 3. `keytool -genkeypair …` | Yes, with `-storepass:env` instead of typing at the prompt | Transcript F |
| 4A. `keystore.properties` | Yes | Signed bundle (transcript G); the file shows as ignored |
| 4B. Environment variables | Yes; `Read-Host -AsSecureString` fed by `ConvertTo-SecureString` (no keyboard here); bash `read -rsp` fed from a file | The conversion gives back the password (F); signed bundles (G, H) |
| 5. Remove `node_modules` | **Not run**: the fresh clone has none (`Test-Path` False), and this session's safety check blocks `Remove-Item` there | — |
| 5. `npm ci`, `npm test` | Yes | "up to date"; 219/219 (F, H) |
| 5. `gradlew clean`, `lintRelease` | Yes | 0 errors, 15 warnings (G) |
| 6–7. `bundleRelease`, the `.aab` | Yes, against the minimal SDK | Built; no extra SDK package downloaded (G) |
| 8. jarsigner, bundletool validate and dump, the checks script | Yes | All as expected; "all checks passed" (G, I) |
| 9. `keytool -list -v … | Select-String SHA256:` | Yes | 32 pairs, the format `assetlinks.json` takes (masked in G) |
| 10. versionCode | Not a command | Covered by `tests/android.test.js` |

**Fixed in this session because of the run (as the card asks):**
- The first build of a fresh clone left `app/src/main/res/xml/shortcuts.xml` modified:
  Bubblewrap's own `generateShorcutsFile` Gradle task rewrites it without the licence header, and
  with LF while `core.autocrlf` had checked it out with CRLF. Fixed by committing the file as the
  task writes it and pinning it to LF in `android/.gitattributes` (D8). A third clean clone
  then built debug and release and `git status` listed nothing (transcript I).
- The guide's disk sizes, and the checks script's version check (it now reads
  `twa-manifest.json`, so it still passes after a version bump).

## SF-016 — Play Console declarations

`docs/google-play/PLAY_CONSOLE_DECLARATIONS.md`: section 0 (the facts: where each piece of data
goes, and a cross-check table from each data type to the code line that sends or keeps it),
then one section per declaration with the brief's 10 questions: Data safety, Privacy policy,
App access, Ads, Content rating (IARC, "users interact"), Target audience, Financial features,
Health apps, Sensitive permissions, Account creation and deletion, Advertising ID, News apps,
Government apps, any other (COVID-19 contact tracing, from Play's list checked 2026-10-01 IST),
and section 15, the owner's confirmations. `docs/google-play/REVIEWER_ACCESS.md`: the reviewer
steps (start a group, add three people, an expense split three ways, the balances, delete it),
no credentials, the optional demo link as `<PLAY_REVIEWER_GROUP_LINK>` (Play Console only).

| Criterion | Result |
|---|---|
| A section per listed declaration, plus any other Play lists (checked, dated) | Met |
| Each answers the 10 questions | Met (rows 1–10 in each table) |
| OWNER CONFIRMATION REQUIRED for the target age, support email, data location, retention, the API-key question | Met. Data location is now known from the code and the records: SQLite on a Railway volume in Southeast Asia (Singapore). The Firebase API-key question no longer exists (Firebase removed, SF-038) |
| Data safety uses Google's own definitions; the SDK's disclosure, cited with the date | Met: Google's definitions quoted (checked 2026-10-01 IST). The page and the app have no data-collecting SDK any more (Firebase removed), so there is no SDK disclosure to cite; Google Fonts and Railway are covered instead |
| App access: no login; reviewer steps; optional `<PLAY_REVIEWER_GROUP_LINK>`, never in git | Met; the path matches T-04's browser check B12–B13, labels checked against `index.html` |
| `REVIEWER_ACCESS.md` says no credentials exist | Met |
| Consistency with SF-006: the guessable-name risk stated if D-4 was declined | D-4 was accepted (random codes for new groups); the old-style family code's guessability (N-3) is still stated plainly in Data safety |
| A cross-check table; no yes or no without evidence or a marker | Met |

## Changes

| File | What changed |
|---|---|
| `android/` (40 files, new) | The Bubblewrap project (generated), plus `app/release.gradle`, `keystore.properties.example`, `.gitattributes`, the `apply from` line, and `shortcuts.xml` as the build writes it |
| `tests/android.test.js` (new) | 5 tests: package, host and name; colours and icon; no permissions or features; API levels and versions agree; release shrinking and upload-key signing (incl. the `apply from` line), placeholders only in the example, `.gitignore` entries, `gradlew` LF |
| `tests/wiring.test.js` | `assetlinks.json` may hold 2–5 unique fingerprints (was exactly 2): Play's hybrid signing lists three app signing keys (D7) |
| `docs/google-play/ANDROID_APPROACH.md`, `BUILD_RELEASE.md`, `PLAY_CONSOLE_DECLARATIONS.md`, `REVIEWER_ACCESS.md` (new) | SF-012, SF-014, SF-016 |
| `docs/google-play/HOSTING_RAILWAY.md`, `PLAY_CONSOLE_SETUP.md` | The fingerprint steps now point to BUILD_RELEASE.md; hybrid signing; Play's current menu path (VERIFY IN PLAY CONSOLE) |
| `docs/google-play/PRODUCTION_AUDIT.md` | A T-05 paragraph for SF-021 |
| `README.md` | `android/` in the map, "Build the Android app", the test list |
| `CLAUDE.md` | The Android project line; `tests/android.test.js` in the test list |
| `docs/planning/stories/SF-017, 018, 019, 021.md` | "Follow-ups from T-05" sections |
| `docs/planning/evidence/T-05-*` (new) | The checks script, the break checks and their output, the combined transcripts, the icon check |

## Decisions for the reviewer

- **D1 — Generated without the interactive `init`.** `bubblewrap init` only asks questions. The
  session built `twa-manifest.json` with Bubblewrap's own `TwaManifest.fromWebManifest` on the
  live manifest (what `init` does), set the answers, and ran `bubblewrap update
  --skipVersionUpgrade`. Example: `startUrl` `/index.html` and `fullScopeUrl` `/` came from the
  live manifest's `start_url` and `scope`. Cost: none known; the owner can regenerate the same
  way (ANDROID_APPROACH.md).
- **D2 — Colours from T-04, and a white divider.** The card's `#F6F4EF`/`#2F5D50` were the old
  design; its own T-04 follow-up says use the manifest's. Status bar `#4F46E5` in light and dark
  mode (the page has no dark theme), navigation bar `#FFFFFF` (the page's white bottom bar).
  Bubblewrap's colour class drops alpha, so its default divider `#00000000` would have become
  opaque **black**; it is `#FFFFFF`. Guarded by `tests/android.test.js` (break K6).
- **D3 — No separate `icon-maskable-512.png`.** The card was written when the old icon broke the
  safe zone; D-19's `icon-512.png` already has its "S" inside the 80% circle (corners at about
  180–187 px from the centre of 512, limit 205), and the circle-mask check confirms it. So the
  web manifest, the icons and the service-worker cache stay as they are: no web deploy.
- **D4 — No permissions, not even `INTERNET`.** The card expected `INTERNET` only. A TWA's
  networking is the browser's; Bubblewrap adds `INTERNET` only for the WebView fallback, which
  is off (`fallbackType: customtabs`). Fewer permissions is the safe side of the criterion.
- **D5 — Signing in its own file, all or nothing, and only on packaging tasks.** `release.gradle`
  survives `bubblewrap update` (only one `apply from` line is lost, and `npm test` fails until it
  is back: break K1, because without it Gradle quietly makes an **unsigned** bundle, which was
  checked). If any `SPLITFAMILIA_UPLOAD_*` variable is set, all four must be, so a stale
  variable can't mix with the file. The check stops only `assembleRelease`, `bundleRelease`,
  `packageRelease`, `packageReleaseBundle`, `signReleaseBundle` and `installRelease`, so
  `lintRelease` runs without a key (transcript D ran with none). Messages never contain a
  password; they may show the keystore path.
- **D6 — Builds outside OneDrive.** Every Gradle build ran on a scratchpad copy or clone, so
  hundreds of MB of build output didn't sync to OneDrive; the guide tells the owner to clone
  outside OneDrive. (VS Code's Gradle support imported `android/` by itself once, at 21:20 IST,
  creating the ignored `android/.gradle/` and `android/build/`; they were removed.)
- **D7 — `assetlinks.json` may hold two to five fingerprints.** Play's App Signing page
  (checked 2026-10-01 IST) now says a new app gets "quantum-ready, hybrid signing" and "you must
  copy the fingerprints for three keys and register each of them". With the upload key that is
  four; the test allowed exactly two and would have blocked the owner's step. It now allows 2–5,
  no duplicates; each still a placeholder or a real `AB:CD:…` fingerprint.
- **D8 — `shortcuts.xml` kept as the build writes it, with LF.** See SF-014. The alternative
  (changing Bubblewrap's Gradle task) would be lost on the next `bubblewrap update`.
- **D9 — Data safety: three data types, IP addresses and the group code not declared.** Name,
  Other financial info, Other user-generated content, all for App functionality, none shared
  (Railway is a service provider). IP addresses are used only for limits, in memory, and kept in
  Railway's logs for 30 days; Play has no IP type and asks to disclose by use (not location
  here). The group code identifies a group, not a person. Both are OWNER CONFIRMATION REQUIRED
  with this recommendation.
- **D10 — Financial features: none; target audience: 18 and over.** No category in Play's list
  (checked 2026-10-01 IST) covers recording shared costs; the app moves no money. 18+ keeps the
  app out of the Families policy. Both OWNER CONFIRMATION REQUIRED.
- **D11 — A static R8 check instead of a launch.** No device or emulator; an emulator system
  image is a large download that needs the owner's OK. Checks D1–D4 parse the bundle's DEX and
  R8's mapping to show every class the manifest names survives, and the launcher still extends
  androidbrowserhelper's. A real launch is SF-019's (owner's own phone, internal testing).
- **D12 — Bubblewrap's template left as it is.** Java 8 source/target (warnings on JDK 21),
  `jcenter()`, Gradle deprecation notices, `allowBackup="true"` (the app holds no data of its
  own) and the "Manage space" shortcut (opens the site's settings) are Bubblewrap's defaults;
  changing them would be lost on regeneration and isn't needed.

## Tests

| Check | Command | Result |
|---|---|---|
| Unit and wiring tests | `npm test` | **219/219** (214 before + 5 in `tests/android.test.js`), in the repo and in two clean clones |
| Break checks | `node docs/planning/evidence/T-05-break-checks.mjs` | **13/13** caught (`T-05-break-checks-output.txt`) |
| Debug build | `./gradlew assembleDebug` | Successful (A; clean clones H, I) |
| Negative signing | `./gradlew bundleRelease` with no key / one variable / a file without `keyPassword` | 3 × BUILD FAILED with the message (A) |
| Signed bundle | `./gradlew bundleRelease` (variables; file; PowerShell and bash) | Successful each time (A, G, H, I) |
| Bundle checks | `jarsigner -verify -verbose -certs`, `bundletool validate`, `bundletool dump manifest` | Verified, valid, as expected (B, G) |
| Android checks | `node docs/planning/evidence/T-05-android-checks.mjs <android dir>` | 17/17 (C, G, I) |
| Lint | `./gradlew lintRelease`, `./gradlew lint` | 0 errors; 15 and 17 template warnings (D, G, H) |
| Icon | headless Edge screenshot of `T-05-icon-mask-check.html` | The "S" inside every mask |
| Clean tree after a build | `git status --short` in a fresh clone | Empty (I) |

Not exercised: installing and launching the app (no device or emulator); Digital Asset Links
verification (placeholders, and no Play upload); `bubblewrap update` from the owner's machine;
the guide's two password prompts typed by hand; the persistent `ANDROID_HOME` setting.

## Documentation

New: `ANDROID_APPROACH.md`, `BUILD_RELEASE.md`, `PLAY_CONSOLE_DECLARATIONS.md`,
`REVIEWER_ACCESS.md`. Updated: `README.md`, `HOSTING_RAILWAY.md` section 5,
`PLAY_CONSOLE_SETUP.md` section 6 and checklist, `PRODUCTION_AUDIT.md`, the T-06 cards (SF-017,
SF-018, SF-019, SF-021), and `CLAUDE.md` (the Android project line, and `tests/android.test.js`
in the test list).

## Open limitations and follow-ups

- **The first real launch** (full screen once fingerprints are in, invite links, the in-app
  install-button hiding, colours, offline start): SF-019, on the owner's own phone.
- **`assetlinks.json` placeholders** until the owner's upload key and the first Play upload
  (BUILD_RELEASE.md section 9; a web deploy on the owner's word). SF-021 fails the release while
  one remains.
- **Railway's HTTP logs** keep visitors' IP addresses and paths for 30 days; an invite link's
  `?g=<code>` in a path may land there (only the owner can read them). The privacy policy must
  say so (SF-017); `#g=` links (SF-035, OWNER CONFIRMATION REQUIRED) would keep codes out of
  paths.
- **No themed (monochrome) launcher icon** for Android 13+: optional, later.
- **No emulator check:** D-20, answered 2026-10-01 23:38 IST: the owner's own phone via internal
  testing (SF-019) instead.
- Owner confirmations for the declarations: PLAY_CONSOLE_DECLARATIONS.md section 15 (ten items).
