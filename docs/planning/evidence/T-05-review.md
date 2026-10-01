# T-05 review receipt — The Android app, its signed release build, the build guide and the Play declarations

- **Task:** T-05. Stories: [SF-012](../stories/SF-012.md), [SF-013](../stories/SF-013.md),
  [SF-014](../stories/SF-014.md), [SF-016](../stories/SF-016.md). Implementation receipt:
  [T-05-implementation.md](T-05-implementation.md).
- **Review context:** a fresh-session review, 2026-10-02, about 00:50–01:20 IST, on the owner's
  "continue". Nothing was committed, staged or pushed. Key outputs:
  [T-05-review-output.txt](T-05-review-output.txt) (R1–R11).
- **Reviewed input:** verified. All 29 hash rows of the receipt match the files on disk. The
  `android/` tree (40 files) matches the receipt's digest `f1fae0f5…5105c`, but only in Git Bash's
  `sha256sum` form, which prints `hash *file`. Linux coreutils print `hash  file`, which gives
  `be299b87…fac0d` for the same files (N-19). The baseline is `cc489a5`.
- **Verdict:** `accepted`. Every acceptance criterion of the four stories is met. Three are met
  as the owner's decisions and the cards' own follow-ups allow: the device launch (D-20, moved to
  SF-019), the launch half of the R8 check (D11, the same) and the separate maskable icon file
  (D3). There is no critical, high or medium finding: one low finding (F-15) and three notes, all
  recorded as follow-ups.

## Contract checked and adversarial examples

Each expected result was worked out from the cards, `release.gradle` and BUILD_RELEASE.md
before running. The run was a clean clone in the scratchpad: HEAD plus the 65 uncommitted files,
committed in that clone only, then cloned again, so Windows line endings applied
(`core.autocrlf=true`).

| # | Input | Expected | Observed |
|---|---|---|---|
| 1 | `bundleRelease` and `assembleRelease` with no variable and no `keystore.properties` | Both stop with "SplitFamilia release signing: no upload key …"; no `.aab`/`.apk` written; never the debug key | As expected (R6 S1) |
| 2 | Only `SPLITFAMILIA_UPLOAD_STORE_FILE` set | Stops, naming the three missing variables (all four or none, D5) | As expected (S2) |
| 3 | `keystore.properties` naming a keystore that doesn't exist; then one without `keyPassword` | "the upload keystore file was not found: …"; "… is missing keyPassword"; nothing built | As expected (S3, S3b) |
| 4 | All four variables, wrong password | Gradle's signing step fails ("keystore password was incorrect"); no bundle; the password not in the log | As expected (S4) |
| 5 | Key A in `keystore.properties` **and** key B in the variables | SF-013's order: the variables win, so the bundle is signed by B | `Signed by "CN=T05 Review Key B, O=Scratch"` (S5a) |
| 6 | Key A in `keystore.properties` only | Signed by A | `CN=T05 Review Key A` (S5b); neither password in any log |
| 7 | `packageReleaseUniversalApk` with no key (a release task not in the guard's list) | Stops too, because it depends on the bundle tasks the guard names | The "no upload key" message (S7) |
| 8 | The bundle as Play reads it | `com.splitfamilia.app`, versionCode 1, "1.0.0", targetSdk 36, minSdk 21; no permission but AndroidX's app-private one; the R8 mapping inside the bundle | As expected (R8); 17/17 Android checks on both bundles |
| 9 | Resource shrinking (`shrinkResources true`, added by SF-013; Bubblewrap's own template doesn't shrink resources) | Nothing the manifest or the TWA reads at run time is removed | Only template leftovers are removed (shortcut background, `enableSiteSettingsShortcut`, `fullScopeUrl`), **plus `raw/web_app_manifest`**, Bubblewrap's offline copy of the web manifest for Chrome OS (F-15) |
| 10 | `bubblewrap update` (1.25.0) of `twa-manifest.json` alone, compared with `android/` | Identical except the receipt's hand changes (D1, D5, D8) | Identical: every icon and splash PNG, the manifest, the Java sources and resources. The only differences are the three files of ours, the `apply from` line and its comment, the `shortcuts.xml` header, and `manifest-checksum.txt` (N-18) (R10) |
| 11 | REVIEWER_ACCESS.md's path: "Dinner" ₹300 paid by Asha, split among Asha, Ben and Chitra | 30,000 ÷ 3 = 10,000 paise each; Asha +20,000, Ben and Chitra −10,000: "Ben owes Asha ₹100", "Chitra owes Asha ₹100"; every label it names exists | Every label is in `index.html` (R11); the arithmetic is as the doc says |
| 12 | The declarations' 22 `file:line` references, and five official pages they rely on | Each reference holds the cited code; each quoted policy line is still on its page | All hold (R11). Re-checked 2026-10-02 IST: target API 36 from 2026-08-31; "three keys" under hybrid signing; "My app doesn't provide any financial features"; COVID-19 on the App content list; Railway Pro keeps HTTP logs (with IP and user agent) for 30 days |

## Findings

| ID | Severity | Location | Trigger → observed / expected | Impact | Disposition |
|---|---|---|---|---|---|
| F-15 | Low | `android/app/release.gradle:67` (`shrinkResources true`) | A release build's resource shrinker removes `res/raw/web_app_manifest.json` (R9: "raw:web_app_manifest" in `resources.txt`; no `res/raw` entry in the bundle). Bubblewrap writes that file into every project, and its own template doesn't shrink resources, so a stock Bubblewrap release keeps it. Nothing in the app names it; per [bubblewrap#88](https://github.com/GoogleChromeLabs/bubblewrap/issues/88) it lets Chrome OS install the web app "without a network request". Expected: everything Bubblewrap ships is kept, or the loss is a recorded decision | Phones: none (the app and the merged manifest never read it; 17/17 checks pass). Chrome OS devices from Play: possibly they fetch the manifest from `web_manifest_url` instead, or skip that path. Not verified on Chrome OS | Follow-up on SF-021, before the bundle the owner uploads: add `android/app/src/main/res/raw/keep.xml` with `tools:keep="@raw/web_app_manifest"` (a file of ours that `bubblewrap update` leaves alone), rebuild and check that `resources.txt` no longer lists it. The alternative is to record the loss as accepted |
| N-17 | Note | `docs/google-play/ANDROID_APPROACH.md:157-158` | It says the first real launch is "the owner's internal-testing install (T-06, SF-018)". D-20, the SF-019 card, the receipt and HANDOFF all say SF-019 | A reader looking for the launch checklist opens the wrong card | Follow-up on SF-019: change SF-018 to SF-019 there |
| N-18 | Note | `android/manifest-checksum.txt`, `android/.gitattributes` | The checksum is the SHA-1 of `twa-manifest.json` with LF endings (`19959be8…`). A Windows checkout (`core.autocrlf=true`) gives that file CRLF endings and SHA-1 `8874269…`, so Bubblewrap would see a changed manifest (R10) | Only `bubblewrap build`, which the guide says not to use, would offer to regenerate; `bubblewrap update` writes the CRLF checksum, a harmless one-line diff | Follow-up on SF-021, together with F-15: add `twa-manifest.json text eol=lf` to `android/.gitattributes`. Optional |
| N-19 | Note | The receipt's digest command | `find android -type f \| LC_ALL=C sort \| xargs -d '\n' sha256sum \| sha256sum` gives the recorded digest only in Git Bash, whose `sha256sum` prints `hash *file`; Linux coreutils print `hash  file` | A reviewer on another shell sees a false mismatch (this review did, until it tried the `*` form) | No change. Future receipts name the shell, or hash the listing without the mode marker |

The receipt's decisions D1 to D12 are accepted. D1 is confirmed by #10: the project is
Bubblewrap's output. D3 is confirmed by the mask image, built from the generated `ic_maskable.png`
and `ic_launcher.png`. D4 is confirmed by the merged manifest and the bundle. D5 is confirmed by
#1 to #7. D7 is confirmed by Play's page today. D11 stands: the launch half moves to SF-019 by
D-20, and #9 adds a check of the resources that the receipt didn't have.

## Commands and results

| Check | Command | Result |
|---|---|---|
| Input | the receipt's 29 hashes and the `android/` digest (Node) | 29/29; tree matches in Git Bash's form (N-19); unchanged after every check below |
| Unit and wiring tests | `npm test` (repo, Node 24.21.0) | **219/219** |
| Break checks | `node docs/planning/evidence/T-05-break-checks.mjs` | **13/13** caught; every file restored |
| Clean clone | `git clone`, then `npm ci`, `npm test` | Tree clean; `gradlew` LF, `gradlew.bat` CRLF, `shortcuts.xml` LF; "up to date"; **219/219** with CRLF files |
| Lint | `gradlew clean`, `gradlew lintRelease` (no key) | Successful; **0 errors**, 15 warnings, the receipt's exact list |
| Negative signing | `bundleRelease`, `assembleRelease`, `packageReleaseUniversalApk` without a key; partial variables; missing keystore; missing `keyPassword`; wrong password | 7 × BUILD FAILED with the expected message; no bundle or APK written |
| Signed bundle | `gradlew bundleRelease` (variables over the file; file only) | Successful; signed by B, then A |
| Bundle checks | `jarsigner -verify -verbose -certs`, `bundletool validate`, `bundletool dump manifest`, `jar tf` | Verified (the expected three warnings), valid, as expected; R8 mapping inside |
| Android checks | `node docs/planning/evidence/T-05-android-checks.mjs android` (both bundles) | **17/17**, twice |
| Resource shrinking | `app/build/outputs/mapping/release/resources.txt` | F-15 |
| Regeneration | `npx @bubblewrap/cli@1.25.0 update --skipVersionUpgrade`, then `node docs/planning/evidence/T-05-review-regen-diff.mjs` | Only the documented hand changes, plus N-18 |
| Docs | labels against `index.html`; the 22 references; five official pages | All hold (N-17 aside) |
| Clean-up | the keys, password files, clones and Bubblewrap's scratch folders deleted | 0 key or password files left in the scratchpad |

Not exercised (the same as the implementation, by the owner's decision D-20): installing and
launching the app on a device or emulator, the TWA's in-app detection, Digital Asset Links
verification (the placeholders stay until the owner's key and first upload), the guide's
password prompts typed by hand, and the persistent `ANDROID_HOME` setting. All of these belong to
SF-019, on the owner's own phone.

## Acceptance checklist

| Story | Criterion | Verdict |
|---|---|---|
| SF-012 | `android/` generated by Bubblewrap with `twa-manifest.json`; approach, reasons and risks in ANDROID_APPROACH.md (TWA support and Custom Tab fallback, Play's minimum-functionality policy) | Met (#10; risks section, policies quoted with dates) |
| SF-012 | `com.splitfamilia.app`, label SplitFamilia, versionCode 1, "1.0.0", the Railway host | Met (#8; checks V1–V3, B1) |
| SF-012 | targetSdk = Play's requirement, checked and dated; compileSdk ≥ it; minSdk Bubblewrap's default | Met: 36/36/21; the page re-checked 2026-10-02 IST |
| SF-012 | Merged release manifest: nothing beyond `INTERNET`; no notifications, location, billing or `AD_ID` | Met, stricter: no permission at all (M1–M3, B3) |
| SF-012 | No cleartext | Met (M4) |
| SF-012 | Adaptive icon inside the safe zone; padded maskable icon; cache bump if the manifest changes | Met by D3: D-19's icon is already padded (mask check from the generated files); no manifest change, so no cache bump |
| SF-012 | Splash and bar colours | Met as the card's T-04 follow-up says (`#4F46E5`, `#FFFFFF`; V4) |
| SF-012 | `https://<host>` intent filter with `autoVerify` | Met (M5) |
| SF-012 | `assembleDebug` succeeds; install and open if a device is available | Build met (the receipt's transcripts A, H, I); no device or emulator, and D-20 moves the launch to SF-019 |
| SF-012 | Transcripts; icon under a circle mask | Met |
| SF-013 | `minifyEnabled` and `shrinkResources`; R8 keeps what androidbrowserhelper needs | Met: D2/D4 and #9; the launch half moves to SF-019 (D11, D-20); F-15 is a follow-up, not a failure of this criterion |
| SF-013 | Signing reads the four variables, otherwise `keystore.properties` | Met (#5, #6) |
| SF-013 | `keystore.properties.example` with placeholders only | Met (test; break K11) |
| SF-013 | No credentials → a clear failure, never the debug key | Met (#1–#4, #7; break K9) |
| SF-013 | `bundleRelease` writes `app/build/outputs/bundle/release/app-release.aab` | Met |
| SF-013 | Throwaway key in the scratchpad, deleted afterwards | Met (the receipt's two keys and this review's two, all deleted) |
| SF-013 | jarsigner shows the certificate; bundletool validate passes; dump manifest as expected | Met (#8) |
| SF-013 | `lint` on release; errors fixed or recorded | Met: 0 errors |
| SF-013 | No keystore, properties file, `.aab` or `.apk` tracked | Met: none among the 40 `android/` files; `.gitignore` has every pattern (test); the clone shows them only as ignored |
| SF-014 | BUILD_RELEASE.md: PowerShell commands, with bash where they differ, for clean, install, tests, lint, build, the `.aab`, its path and verification | Met (sections 5–8; this review followed them) |
| SF-014 | Prerequisites with versions and how to get each | Met (section 1) |
| SF-014 | Upload key, MANUAL ACTION REQUIRED: keytool (RSA ≥ 2048, long validity, alias `upload`), storage and backup, the settings file or variables, the SHA-256 for `assetlinks.json`, Play App Signing and where its fingerprints are | Met (sections 3, 4, 9; the menu path matches Play's page today) |
| SF-014 | The `versionCode` rule and where to change it | Met (section 10; `npm test` keeps both files equal, break K3) |
| SF-014 | Every command run from a clean clone; anything not run marked with a reason | Met (receipt SF-014 table; two not run, with reasons) |
| SF-016 | A section per declaration, plus any other Play lists (checked, dated) | Met (sections 1–14) |
| SF-016 | Each answers the 10 questions | Met |
| SF-016 | OWNER CONFIRMATION REQUIRED for age, support email, location, retention, API key | Met; the location is now known (Singapore), and the API-key question went with Firebase |
| SF-016 | Google's data-type definitions, cited and dated; the SDK's disclosure | Met; no data-collecting SDK remains |
| SF-016 | App access: no login, the reviewer steps, the optional link never in git | Met (#11) |
| SF-016 | REVIEWER_ACCESS.md says no credentials exist | Met |
| SF-016 | Consistency with SF-006 / D-4 | Met (the old-style code's guessability stated) |
| SF-016 | Cross-check table; no yes or no without evidence or a marker | Met (#12) |

## Decision and follow-up state

- **accepted.** STATE: T-05 `done`, `review_receipt` set, a `review_outcomes` entry and a
  history line; `active_task` T-05, `next_task` T-06, `next_phase` implementation.
  `production_verification` is `not_applicable`: no web file changed, so a push redeploys
  nothing (`railway.json` doesn't watch `android/`, `docs/` or `tests/`). The Android app
  reaches phones only through the owner's Play uploads; its first real launch is SF-019's.
- Follow-ups: F-15 and N-18 on the SF-021 card (one rebuild before the owner's upload); N-17 on
  the SF-019 card; N-19 needs no change.
- Commit and push only on the owner's word. A push of T-05 deploys nothing.
