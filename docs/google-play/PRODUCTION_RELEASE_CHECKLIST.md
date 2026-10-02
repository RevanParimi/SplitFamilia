# Before you press "Send for review": the production release checklist

One list to work through before sending SplitFamilia's production release for Google's review.
Story SF-020 (task T-06), written on 2026-10-02 (IST). Every checkbox from the owner's brief
(stage 8) is here word for word, under the same headings; each section then adds this app's own
checks.

- **repo** means the repository does it, with recorded evidence (a story and its receipt).
- **MANUAL ACTION REQUIRED** means you do it, in Play Console, Railway, GitHub or on your own
  phone. **VERIFY IN PLAY CONSOLE** and **OWNER CONFIRMATION REQUIRED** as in the other guides.
- **Ticked here** only when it is a repo item with recorded evidence. Nothing that depends on your
  accounts is ticked for you: tick those yourself when they are done. A repo item stays true only
  while nothing changes it; the final audit ([READINESS_REPORT.md](READINESS_REPORT.md)) is the
  last check.

## Developer account

- [ ] Developer verification complete. **MANUAL ACTION REQUIRED.** Identity, developer email,
  contact email and phone, and an Android device: [PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md)
  section 2. VERIFY IN PLAY CONSOLE that every verification shows complete.
- [ ] Registration/payment complete. **MANUAL ACTION REQUIRED.** The one-time US$25 fee, a
  personal account (D-7): [PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md) section 2.

## Application

- [ ] Production backend configured. **MANUAL ACTION REQUIRED** (the Railway service is yours),
  with repo evidence: the server is live at https://splitfamilia.up.railway.app and answered
  `/healthz` 200 with `"storage":"volume"` (T-08's PC-005, T-09's PC-006 and PC-007, T-04's
  PC-009). Tick after the Railway items below.
- [x] HTTPS enabled. **repo:** every shipped file uses `https://` only (`npm test`: "shipped files
  use HTTPS only"); the Android link filter is `https` and cleartext traffic is off (T-05's
  checks M4 and M5); Railway
  redirects http to https (checked 2026-10-01 IST, [PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md)
  section 0).
- [ ] Production environment configured. **MANUAL ACTION REQUIRED:** Railway's variables are
  `PORT=8080` and the volume's own (HOSTING_RAILWAY.md section 3), and nothing else; no
  `IMPORT_TOKEN` (below).
- [x] No production secrets committed. **repo:** the final audit of the whole tree and git history
  (SF-021, [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md) "Final audit") found no secret, keystore,
  key, token or `.env` file; `.gitignore` blocks them. One of the family's real group codes, once a
  test example, stays in public history since `6f3b3fe`: the tree now has a made-up one, and the
  owner accepted the history as it is (D-21, 2026-10-02).
- [ ] Release build tested. **MANUAL ACTION REQUIRED:** the Play-signed build from internal
  testing, on your own phone, by [RELEASE_TESTING.md](RELEASE_TESTING.md) section 3.
- [x] versionCode/versionName correct. **repo:** `versionCode 1`, `versionName "1.0.0"` for the
  first upload, equal in `android/app/build.gradle` and `android/twa-manifest.json` (`npm test`;
  SF-021's bundle check). For every later upload, raise them first
  ([BUILD_RELEASE.md](BUILD_RELEASE.md) section 10) and untick this box until you have.

This app also needs:

- [ ] The Railway volume is mounted and its backups are on (SF-032). **MANUAL ACTION REQUIRED:**
  [HOSTING_RAILWAY.md](HOSTING_RAILWAY.md) section 3a (a volume at `/data`, daily backups; your
  report of 2026-09-30). Re-check: `/healthz` says `"storage":"volume"`, and the service's
  **Backups** tab shows a recent backup.
- [ ] `IMPORT_TOKEN` is removed from Railway's variables (SF-037). **MANUAL ACTION REQUIRED:**
  recorded done on 2026-10-01 (about 10:05 IST: `/api/import` answered 404). Re-check that the
  variable is gone ([MOVE_FROM_FIREBASE.md](MOVE_FROM_FIREBASE.md) step 6).
- [ ] GitHub Pages is off and the Firebase project is deleted (SF-038). **MANUAL ACTION
  REQUIRED** on or after 2026-10-08 00:35 IST (pending check PC-008;
  [MOVE_FROM_FIREBASE.md](MOVE_FROM_FIREBASE.md) step 8).
- [ ] The web app is deployed before the bundle goes live. **MANUAL ACTION REQUIRED** (a push to
  `main` deploys, on your word): the Android app only shows the live site, so every web change
  the release needs (the privacy page, `assetlinks.json`) must be live first.

## Security

- [ ] Signing/upload key securely stored. **MANUAL ACTION REQUIRED:** your upload key and its
  password in two safe places outside the repository and its OneDrive folder
  ([BUILD_RELEASE.md](BUILD_RELEASE.md) section 3).
- [ ] No sensitive information logged. **repo part done:** the server logs at most a method, a
  status and an error code, never an address, a group code or typed text; the page logs at most
  an error code (SF-009, SF-033; SF-021's audit). **OWNER CONFIRMATION REQUIRED:** Railway's own
  HTTP logs keep each request's IP address and path for 30 days, and an invite link's path holds
  its group code ([PRIVACY_POLICY.md](PRIVACY_POLICY.md) section 5). Accept that (the policy says
  so), or choose `#g=` invite links (SF-035), then tick.
- [x] Permissions reviewed. **repo:** the merged release manifest asks for no permission at all
  (only AndroidX's private signature permission); re-checked on the bundle built in SF-021
  (T-05's checks M1–M3; [READINESS_REPORT.md](READINESS_REPORT.md)).
- [x] Authentication/session handling reviewed. **repo:** there is no sign-in, session or token;
  a group's code is its key, sent only in a header (SF-033; [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md)).

This app also needs:

- [ ] `assetlinks.json` has the real fingerprints and is live (SF-011, SF-012). **MANUAL ACTION
  REQUIRED**, then a web deploy: your upload key's and every Play app signing key's SHA-256
  ([BUILD_RELEASE.md](BUILD_RELEASE.md) section 9). Until then the app shows an address bar. The
  final audit fails the release while a placeholder remains.

## Play Store

- [ ] Store listing complete. **MANUAL ACTION REQUIRED:** paste the texts from
  [STORE_LISTING.md](STORE_LISTING.md); choose the category (OWNER CONFIRMATION REQUIRED,
  Finance recommended).
- [ ] App icon uploaded. **MANUAL ACTION REQUIRED:** `icon-512.png`
  ([assets/README.md](assets/README.md)).
- [ ] Screenshots uploaded. **MANUAL ACTION REQUIRED:** the seven in
  `assets/phone-screenshots/`, in order ([STORE_LISTING.md](STORE_LISTING.md)).
- [ ] Feature graphic uploaded. **MANUAL ACTION REQUIRED:** [assets/README.md](assets/README.md).
- [ ] Support details entered. **MANUAL ACTION REQUIRED:** a support email (not your personal
  one) and optionally a website (STORE_LISTING.md "Contact details").
- [ ] Privacy policy publicly accessible. **MANUAL ACTION REQUIRED:** approve the policy and fill
  in its placeholders ([PRIVACY_POLICY.md](PRIVACY_POLICY.md) section F), have a session remove
  the "Draft" note, deploy, then check https://splitfamilia.up.railway.app/privacy.html opens
  (pending check PC-010).

This app also needs:

- [ ] The privacy policy URL is live and linked in the app (SF-018). **repo part done:** the page
  is linked from the welcome screen and the group menu, and opens offline
  ([RELEASE_TESTING.md](RELEASE_TESTING.md) test S5; T-06 receipt). Tick when the box above is
  ticked and the URL is pasted in App content → Privacy policy.

## Compliance

- [ ] Data Safety completed. **MANUAL ACTION REQUIRED:** [PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md)
  section 1, and its owner answers (section 15). The answers must match the privacy policy
  ([PRIVACY_POLICY.md](PRIVACY_POLICY.md) section D).
- [ ] App Access completed. **MANUAL ACTION REQUIRED:** "All functionality ... without any access
  restrictions", with [REVIEWER_ACCESS.md](REVIEWER_ACCESS.md)'s text.
- [ ] Ads declaration completed. **MANUAL ACTION REQUIRED:** "No" (declarations section 4).
- [ ] Content Rating completed. **MANUAL ACTION REQUIRED:** the IARC questionnaire (declarations
  section 5).
- [ ] Target Audience completed. **MANUAL ACTION REQUIRED:** 18 and over recommended (declarations
  section 6; confirmed by the owner on 2026-10-02).
- [ ] Financial Features completed. **MANUAL ACTION REQUIRED:** "My app doesn't provide any
  financial features" (declarations section 7; confirmed by the owner on 2026-10-02).
- [ ] Health declaration completed if required. **MANUAL ACTION REQUIRED:** "My app does not have
  any health features" (declarations section 8).
- [x] Sensitive permission declarations completed if required. **repo:** not required: the app
  asks for no permission (declarations section 9; SF-021's bundle check). VERIFY IN PLAY CONSOLE
  that no permission form appears after the upload.
- [x] Account deletion requirements satisfied. **repo:** not applicable: the app has no accounts
  ([PRIVACY_POLICY.md](PRIVACY_POLICY.md) section B, Play's page checked 2026-10-02 IST).

This app also needs:

- [ ] The other App content items answered: Advertising ID "No", News "No", Government "No",
  COVID-19 "No" (declarations sections 11–14). **MANUAL ACTION REQUIRED.**

## Testing

- [ ] Internal testing completed. **MANUAL ACTION REQUIRED:** [RELEASE_TESTING.md](RELEASE_TESTING.md)
  section 5, all of section 3 on your own phone.
- [ ] Closed testing completed if required. **MANUAL ACTION REQUIRED:** required for a new
  personal account: 12 testers opted in for 14 continuous days, then production access granted
  (RELEASE_TESTING.md section 5; VERIFY IN PLAY CONSOLE).
- [ ] Production AAB tested. **MANUAL ACTION REQUIRED:** the exact bundle you send for review,
  installed from a testing track (RELEASE_TESTING.md section 2), plus its pre-launch report.
- [x] Reviewer/demo account created if authentication is required. **repo:** not required: no
  sign-in ([REVIEWER_ACCESS.md](REVIEWER_ACCESS.md)). A demo group link for reviewers is optional
  (none for now: the owner's choice on 2026-10-02; Play Console only, never git).

## Release

- [ ] Correct AAB uploaded. **MANUAL ACTION REQUIRED:** `app-release.aab` built from the
  reviewed commit with **your upload key** ([BUILD_RELEASE.md](BUILD_RELEASE.md) sections 4–8),
  with all 17 Android checks passing.
- [ ] Release notes entered. **MANUAL ACTION REQUIRED:** for example from STORE_LISTING.md's
  "Main features".
- [ ] Countries/regions selected. **MANUAL ACTION REQUIRED** (OWNER CONFIRMATION REQUIRED: which).
- [ ] Pricing configured. **MANUAL ACTION REQUIRED:** Free (it can't become paid later;
  PLAY_CONSOLE_SETUP.md section 5).
- [ ] Production release reviewed. **MANUAL ACTION REQUIRED:** Play Console's release summary
  shows no errors or warnings you haven't read.
- [ ] Ready to submit for Google review. **MANUAL ACTION REQUIRED:** every box above ticked.

This app also needs:

- [ ] `versionCode` was raised for this upload, if any bundle was uploaded before (any track).
  **MANUAL ACTION REQUIRED** with a session's help ([BUILD_RELEASE.md](BUILD_RELEASE.md)
  section 10).

## The order on release day

1. Web first: the privacy page approved and live, `assetlinks.json` with every fingerprint live
   (pushes to `main`, on your word).
2. Build the bundle from that commit with your upload key; run BUILD_RELEASE.md section 8.
3. Upload to internal testing; run RELEASE_TESTING.md on your phone; read the pre-launch report.
4. Closed testing for 14 days (first release only), then apply for production access.
5. Tick everything here, then **Send for review**.
