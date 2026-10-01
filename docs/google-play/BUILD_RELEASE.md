# Build the signed release: `app-release.aab`

From a fresh clone to a signed `app-release.aab` made with **your own upload key**, on Windows.
Commands are for PowerShell, with bash equivalents where they differ. Story SF-014 (task T-05).

- **What the repository does:** the Android project in `android/` (see
  [ANDROID_APPROACH.md](ANDROID_APPROACH.md)), a release build that is shrunk by R8 and signed
  only with your upload key, and the checks below. It never holds your key or passwords.
- **What only you can do** is marked **MANUAL ACTION REQUIRED**: install the tools, create the
  upload key and keep it safe, and do everything in Play Console. Facts that depend on your
  account are marked **VERIFY IN PLAY CONSOLE**.

Every command here was run in T-05 (2026-10-01 IST) from a clean clone, and the results are in
the [T-05 implementation receipt](../planning/evidence/T-05-implementation.md), SF-014.

## 1. What you need (MANUAL ACTION REQUIRED, once)

| Tool | Version used in T-05 | How to get it | Needed for |
|---|---|---|---|
| Git | 2.55 | https://git-scm.com | the clone |
| Node.js | 24.21.0 (npm 11.19) | https://nodejs.org (Node 24 LTS) | `npm test` (needs Node 24 for `node:sqlite`) |
| JDK | 21 (Eclipse Temurin 21.0.12.1) | `winget install EclipseAdoptium.Temurin.21.JDK` | Gradle, `keytool`, `jarsigner` |
| Android SDK command-line tools | latest (`commandlinetools-win-16111833`) | below | `sdkmanager` |
| Android SDK packages | `platform-tools` 37.0.1, `platforms;android-36`, `build-tools;35.0.0` | below | the build (Android Gradle plugin 8.9.1 uses build-tools 35.0.0) |
| bundletool | 1.18.3 | below | checking the `.aab` |
| Gradle | 8.11.1 | nothing to do: `gradlew` downloads it on first use | the build |

Space: about 600 MB for the Android SDK and 750 MB for Gradle and its libraries, plus a few
minutes of downloading the first time. (Android Studio is an alternative: it installs the SDK, and its SDK
Manager installs the same three packages.)

Install the Android SDK and bundletool (PowerShell). Installing the SDK packages means accepting
the [Android SDK License Agreement](https://developer.android.com/studio/terms):

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
Invoke-WebRequest https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip -OutFile "$env:TEMP\cmdline-tools.zip"
Expand-Archive "$env:TEMP\cmdline-tools.zip" -DestinationPath "$env:TEMP\cmdline-tools" -Force
New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
Move-Item "$env:TEMP\cmdline-tools\cmdline-tools" "$sdk\cmdline-tools\latest"
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms/android-36" "build-tools/35.0.0"
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdk, "User")

New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\Android\bundletool" | Out-Null
Invoke-WebRequest https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar -OutFile "$env:LOCALAPPDATA\Android\bundletool\bundletool-all-1.18.3.jar"
```

Write the package names with a slash (`platforms/android-36`): the batch file splits
`platforms;android-36` at the semicolon. Close and reopen PowerShell afterwards, so it sees
`ANDROID_HOME` (and `JAVA_HOME` from the JDK installer). Check with `java -version` (21) and
`echo $env:ANDROID_HOME`.

## 2. Get the code

Clone it **outside OneDrive** (Gradle writes a few hundred MB of build files that OneDrive would
otherwise upload):

```powershell
git clone <your repository URL> C:\dev\SplitFamilia
cd C:\dev\SplitFamilia
```

## 3. Create your upload key (MANUAL ACTION REQUIRED, once)

The upload key proves to Google Play that an upload comes from you. Google keeps the separate
app signing key (see [PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md), section 6). **Never** put
the upload key in this repository, its OneDrive folder, an email or a chat.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\splitfamilia-keys" | Out-Null
keytool -genkeypair -v -keystore "$env:USERPROFILE\splitfamilia-keys\splitfamilia-upload.jks" -alias upload -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=SplitFamilia, O=SplitFamilia"
```

- `keytool` asks for a password twice. Use a long one and save it in your password manager
  straight away. (Its default keystore type, PKCS12, has a single password: the store password
  and the key password are the same.)
- RSA 4096 (Play needs 2048 bits or more), valid for 10,000 days (about 27 years). The name in
  the certificate is "SplitFamilia", not your own.
- **Back it up**: keep `splitfamilia-upload.jks` and its password in two safe places, for
  example your password manager plus an offline copy (a USB drive kept at home).
- If it is ever lost or leaked, you are not locked out: Google can reset the upload key
  (PLAY_CONSOLE_SETUP.md, section 6).

## 4. Tell the build where your key is

The release build reads, in this order: the four environment variables below (if any of them is
set, all four must be), otherwise `android\keystore.properties`. Without either, it stops with a
"SplitFamilia release signing" message. It never signs a release with the debug key.

**Option A, a settings file (simplest).** `android\keystore.properties` is git-ignored.

```powershell
Copy-Item android\keystore.properties.example android\keystore.properties
notepad android\keystore.properties
```

Fill in the path with forward slashes (`C:/Users/<you>/splitfamilia-keys/splitfamilia-upload.jks`;
a backslash is an escape character in this file), the password twice, and `keyAlias=upload`.
Save. The file holds your password in plain text, so keep the clone on your own account only;
delete the file after building if you prefer.

**Option B, environment variables (this PowerShell window only):**

```powershell
$env:SPLITFAMILIA_UPLOAD_STORE_FILE = "$env:USERPROFILE\splitfamilia-keys\splitfamilia-upload.jks"
$env:SPLITFAMILIA_UPLOAD_KEY_ALIAS = "upload"
$p = Read-Host "Upload key password" -AsSecureString
$env:SPLITFAMILIA_UPLOAD_STORE_PASSWORD = [System.Net.NetworkCredential]::new("", $p).Password
$env:SPLITFAMILIA_UPLOAD_KEY_PASSWORD = $env:SPLITFAMILIA_UPLOAD_STORE_PASSWORD
```

bash:

```bash
export SPLITFAMILIA_UPLOAD_STORE_FILE="$HOME/splitfamilia-keys/splitfamilia-upload.jks"
export SPLITFAMILIA_UPLOAD_KEY_ALIAS=upload
read -rsp "Upload key password: " SPLITFAMILIA_UPLOAD_STORE_PASSWORD; echo
export SPLITFAMILIA_UPLOAD_STORE_PASSWORD SPLITFAMILIA_UPLOAD_KEY_PASSWORD="$SPLITFAMILIA_UPLOAD_STORE_PASSWORD"
```

## 5. Clean, install, test and lint

```powershell
cd C:\dev\SplitFamilia
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
npm ci
npm test
cd android
.\gradlew.bat clean
.\gradlew.bat lintRelease
```

bash: `rm -rf node_modules`, then the same, with `./gradlew` for `.\gradlew.bat`.

What to expect:

- `npm ci`: "up to date": the project has no dependencies at all.
- `npm test`: every test passes (219 in T-05), with no install and no network.
- There is no separate web linter (the project has no dependencies by design); `npm test`
  includes the checks that the page, service worker, server and Docker image agree. The old
  `npm run test:rules` was removed with Firebase (SF-038).
- `lintRelease` (Android lint on the release build): **0 errors**. In T-05 it reported 15
  warnings, all from Bubblewrap's template and accepted: the full-square launcher icons for
  Android 5 to 7, no monochrome (themed) icon, the portrait lock, `autoVerify` being ignored
  below Android 6, and seven unused template resources. The report is
  `android\app\build\reports\lint-results-release.html`.
- The first Gradle run downloads Gradle 8.11.1 and the libraries; later runs are quicker.

## 6. Build the signed release bundle

```powershell
.\gradlew.bat bundleRelease
```

It compiles, shrinks with R8, and signs with your upload key. Expect `BUILD SUCCESSFUL`.

## 7. Find the `.aab`

```
android\app\build\outputs\bundle\release\app-release.aab
```

About 2 MB. This is the file you upload to Play Console. It already carries R8's mapping file
(`BUNDLE-METADATA/.../proguard.map`), so there is no separate deobfuscation file to upload.
The `.aab` is git-ignored: don't commit it.

## 8. Verify it

From `android\`:

```powershell
$aab = "app\build\outputs\bundle\release\app-release.aab"
$bundletool = "$env:LOCALAPPDATA\Android\bundletool\bundletool-all-1.18.3.jar"
jarsigner -verify -verbose -certs $aab | Select-String "jar verified|Signed by"
java -jar $bundletool validate --bundle=$aab
java -jar $bundletool dump manifest --bundle=$aab | Select-String "versionCode|SdkVersion|uses-permission"
cd ..
$env:BUNDLETOOL = $bundletool
node docs\planning\evidence\T-05-android-checks.mjs android
```

bash: `grep -E` for `Select-String`, `$LOCALAPPDATA/Android/bundletool/...` for the jar, and
`BUNDLETOOL=... node docs/planning/evidence/T-05-android-checks.mjs android`.

What to expect:

- `jarsigner`: `jar verified.` and `Signed by "CN=SplitFamilia, O=SplitFamilia"` (your key). Its
  warnings are expected: the certificate is self-signed (upload keys always are), there is no
  timestamp (Android doesn't use one), and JDK 21's `jarsigner` notes "internal
  inconsistencies ... JarInputStream" because of how the Android Gradle plugin lays out every
  bundle. `bundletool validate` is the check of the bundle's structure.
- `bundletool validate`: lists the bundle's files and ends without an error.
- `dump manifest`: `package="com.splitfamilia.app"`, your `versionCode`, `targetSdkVersion="36"`,
  and one permission, `com.splitfamilia.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (AndroidX's
  private one; [ANDROID_APPROACH.md](ANDROID_APPROACH.md) explains).
- The checks script: `all checks passed` (17 checks: permissions, cleartext, the link filter,
  colours, the package and versions, and that R8 kept every class the app needs). It reads the
  expected version from `android/twa-manifest.json`.

## 9. The fingerprints for `assetlinks.json` (MANUAL ACTION REQUIRED, then a web deploy)

Until the site's `/.well-known/assetlinks.json` lists the right fingerprints, the app works
but shows an address bar ([ANDROID_APPROACH.md](ANDROID_APPROACH.md), "Verified links"). The
fingerprints are public, so you can paste them into a chat.

1. **Your upload key** (for a build you install by hand):

   ```powershell
   keytool -list -v -keystore "$env:USERPROFILE\splitfamilia-keys\splitfamilia-upload.jks" -alias upload
   ```

   Copy the `SHA256:` line (32 pairs like `AB:CD:…`). It replaces `<UPLOAD_KEY_SHA256>`.
2. **Google's app signing keys** (for every install from Google Play), after your first upload:
   **VERIFY IN PLAY CONSOLE:** your app → **Protected with Play → Play Store distribution → Go to
   Play app signing** (older guides: Test and release → App integrity → App signing). Copy the
   SHA-256 of **every** app signing key shown there. A new app gets "quantum-ready, hybrid
   signing", and Play lists **three** keys to register ([Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756),
   checked 2026-10-01 IST). They replace `<PLAY_APP_SIGNING_SHA256>`: one line each.
3. Give the fingerprints to a Claude Code session. It edits `.well-known/assetlinks.json`
   (`npm test` checks the format and accepts two to five fingerprints) and pushes on your word:
   that is a production deploy. Then check
   https://splitfamilia.up.railway.app/.well-known/assetlinks.json in a browser.

## 10. Every upload needs a higher `versionCode`

Play refuses a bundle whose `versionCode` isn't higher than every one uploaded before (on any
track). Change it in **both** places, keeping them equal (`npm test` checks):

| File | Fields |
|---|---|
| `android/app/build.gradle` | `versionCode 2`, `versionName "1.0.1"` |
| `android/twa-manifest.json` | `"appVersionCode": 2`, `"appVersionName": "1.0.1"`, `"appVersion": "1.0.1"` |

`versionCode` is a whole number that only goes up; `versionName` is what people see. Web changes
don't need any of this: they reach the app with each Railway deploy. Only a change to the
Android wrapper (version, icon, colours, settings) needs a new upload.

## 11. If something goes wrong

| What you see | What to do |
|---|---|
| `SplitFamilia release signing: no upload key ...` (or `... is missing keyPassword`, `... not found`) | Section 4: the file or variables are missing or incomplete, or the keystore path is wrong |
| `SDK location not found` | Set `ANDROID_HOME` (section 1), or create `android\local.properties` (git-ignored) with `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` |
| `Connection timed out` while Gradle downloads | On some networks Java tries IPv6 and times out (T-05's machine did). In that window: `$env:JAVA_TOOL_OPTIONS = "-Djava.net.preferIPv4Stack=true"` (bash: `export JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`), then run the command again |
| `source value 8 is obsolete`, `Deprecated Gradle features were used` | Harmless warnings from Bubblewrap's template |
| `npm test` fails at "android/app/build.gradle must end with apply from: 'release.gradle'" | Someone ran `bubblewrap update`: put the line back ([ANDROID_APPROACH.md](ANDROID_APPROACH.md)) |
| `keytool` or `jarsigner` not found | The JDK's `bin` folder isn't on `PATH`: reopen PowerShell after installing the JDK |

## 12. Then

Upload the `.aab` in Play Console (internal or closed testing first). That, the testers and the
store listing are yours to do: [PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md),
[STORE_LISTING.md](STORE_LISTING.md) and the Play Console declarations
([PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md)). Never upload anything from a
Claude Code session.
