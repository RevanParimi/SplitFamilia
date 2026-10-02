# Testing a release of SplitFamilia

The checklist to work through before each Play release, matched to what the app does today
(after T-06, 2026-10-02 IST), and the path Internal testing → Closed testing → Production. Story
SF-019 (task T-06).

- **What the repository does:** the automated tests (section 1) and the Android build checks.
- **What you do by hand** is marked **MANUAL ACTION REQUIRED**: the manual tests (sections 2–4)
  on **your own phone** and a computer, and everything in Play Console (section 5).
- **VERIFY IN PLAY CONSOLE** marks what depends on your account or Play's current rules.
- Nothing here asks you to set up or check anyone else's phone. Testers in a closed test install
  and use the app on their own phones, by themselves.

Sources, checked on 2026-10-02 (IST):
[App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465),
[Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334),
[Use pre-launch reports](https://support.google.com/googleplay/android-developer/answer/9842757).

## 1. Automated checks (repo, before every release)

Run from a clone of the repository, as in [BUILD_RELEASE.md](BUILD_RELEASE.md):

| Check | Command | Pass |
|---|---|---|
| Unit, server, page-client, service-worker and wiring tests | `npm test` | every test passes (230 since T-06's rework), no install, no network |
| Android lint | `.\gradlew.bat lintRelease` in `android\` | 0 errors |
| The bundle | `.\gradlew.bat bundleRelease`, then BUILD_RELEASE.md section 8 | `jarsigner`, `bundletool validate` and `T-05-android-checks.mjs` all pass |

There is no separate rules test any more: `npm run test:rules` went with Firebase (SF-038).

## 2. What to test on, and which build

**MANUAL ACTION REQUIRED.**

- **The build:** always the **Play-signed build from the internal testing track** (section 5),
  installed from the Play Store through the testers' link. Never a debug build, and never a
  bundle you signed and sideloaded: only Play's build has Google's signature, and only that one
  opens full screen once `assetlinks.json` lists Play's fingerprints.
- **Your own phone:** every test in sections 3 and 4. Note its Android version (Settings → About
  phone).
- **A computer:** Chrome (or Edge) on https://splitfamilia.up.railway.app, as a second device in
  the same group (for live sync and the "someone else changed it" tests), and for screen sizes.
- **Android versions:** the app supports Android 5.0 (API 21, the minimum) to Android 16 (API 36,
  the target).
  - Your phone covers one version.
  - Play's **pre-launch report** runs each uploaded bundle on Google's own devices, phones and
    tablets with **Android 9 and above**, usually within an hour of the upload ("Use pre-launch
    reports"). Open it in Play Console (**VERIFY IN PLAY CONSOLE:** Test and release → Testing →
    Pre-launch report) and read its stability, accessibility and screenshot results.
  - **Android 5 to 8** (API 21–27) are covered by neither. Old phones keep an old Chrome, which
    may lack newer web features; the page has fallbacks for its sheets and its message bar. To
    test there, use an emulator in Android Studio (a large download, your choice; D-20) or accept
    the risk.
- **Screen sizes:** on the computer, Chrome DevTools → Toggle device toolbar, at 360 × 640 (a
  small phone), 412 × 915 (a large phone) and 800 × 1280 (a tablet: from 700 px wide the group
  page has two columns and the sheets are centred panels). The pre-launch report adds tablet
  screenshots.
- **Slow network:** on the computer, DevTools → Network → throttling "Slow 4G" (or "3G"). On your
  phone, the same with Chrome remote debugging: phone on USB with USB debugging on, then
  `chrome://inspect` on the computer, **inspect** the SplitFamilia page, Network → throttling.

## 3. The checklist

Work through it in order: later tests use the group and entries from earlier ones. Amounts are
shown as ₹ with two decimals; balances list the largest debt first, and rows with equal amounts
can come in either order. Mark each test pass or fail, with what you saw if it failed.

Items from the brief that the app doesn't have are marked **Not in this app**.

### Install and start

| # | Test | Steps | Expected |
|---|---|---|---|
| I1 | Fresh installation | Install SplitFamilia from the internal testing link. Open it | The SplitFamilia splash (white, the icon), then the welcome screen: "SplitFamilia", "a running ledger for shared costs", "Start a new group", "Join with a link", and the small print with **Privacy policy**. No "Install app" button inside the app |
| I2 | Registration | — | **Not in this app:** there are no accounts. Nothing asks for an email, phone or password |
| I3 | Login | — | **Not in this app:** no accounts. A group opens from its invite link instead |
| I4 | Password reset | — | **Not in this app:** no passwords |

### Groups and people

| # | Test | Steps | Expected |
|---|---|---|---|
| G1 | Create a group | Tap **Start a new group**, type "Goa trip", tap **Start group** | The group page, titled "Goa trip", with the guide: "Step 1 of 3", "Who's sharing costs?" |
| G2 | Add members | Tap **Add people**. Under **Add a person** type "Asha", tap **Add**; then "Ben" and "Chitra". Close the sheet (×) | People shows Asha, Ben, Chitra; the header says "3 people"; the guide moves to "Step 2 of 3", "Add the first expense" |
| G3 | A name left empty | In People, tap **Add** with the name empty | Nothing is added |

### Expenses, splitting and balances (worked by hand)

| # | Test | Steps | Expected |
|---|---|---|---|
| M1 | Create an expense | Tap **Add expense**. "What was it for?" Dinner; **Amount** 300; **Paid by** Asha; split equally among everyone. Tap **Add expense** | Expenses: "Dinner", ₹300.00, "paid by Asha · split among everyone". Balances: "Ben owes Asha ₹100.00" and "Chitra owes Asha ₹100.00" (₹300 ÷ 3 = ₹100 each; Asha paid, so the other two owe her) |
| M2 | Form checks | Tap **Add expense**, leave both fields empty, tap **Add expense**. Then type an amount of 0 | Under the fields: "Add a description." and "Enter an amount."; with 0, an error under **Amount**. Nothing is added. Close the sheet |
| M3 | Split among some people | Add "Taxi", ₹100, paid by Asha. Tap **Change** next to "Split equally among everyone", untick Asha, tap **Done**. Before saving, the hint says "₹50.00 each". Save | Taxi: "paid by Asha · split among 2". Balances: "Ben owes Asha ₹150.00", "Chitra owes Asha ₹150.00" (₹100 + ₹50 each) |
| M4 | Delete an expense | Tap "Taxi", tap **Delete** | A confirmation: "Delete ‘Taxi’ (₹100.00)?" with Cancel and Delete. Tap **Delete**: Taxi is gone; balances back to ₹100.00 each |
| M5 | Rounding to the paisa | Start a second group, "Rounding test", with Asha, Ben, Chitra and Dev. Add "Cake", ₹100, paid by Asha, split among Ben, Chitra and Dev only (untick Asha) | Three rows that add up to exactly ₹100.00: one person owes Asha ₹33.34, the other two ₹33.33 each. The extra paisa always goes to the same person on every phone. (Split among all four instead, ₹100 is ₹25.00 each) |
| M6 | Rounding with the payer included | In "Rounding test", delete Cake and add "Cake", ₹100, paid by Asha, split among Asha, Ben and Chitra | Asha is owed ₹66.67 (₹33.34 + ₹33.33) or ₹66.66 (₹33.33 + ₹33.33): one of the three shares is ₹33.34, and Asha's own share is the rest. The shares always add up to ₹100.00. Then go back to "Goa trip" (group menu → **Switch group** → "Goa trip") |
| M7 | Record a part payment | In "Goa trip", tap "Ben owes Asha ₹100.00" | The **Record payment** sheet: "Ben paid Asha", amount 100.00, "That's everything Ben owes. Change it for a part payment.", and "This only records a payment made outside the app. SplitFamilia never moves money." Change the amount to 40, tap **Record payment**: balances "Chitra owes Asha ₹100.00" and "Ben owes Asha ₹60.00"; Expenses shows "Ben paid Asha", ₹40.00, "· payment" |
| M8 | Record a full payment | Tap "Chitra owes Asha ₹100.00", tap **Record payment** | Only "Ben owes Asha ₹60.00" is left |
| M9 | Edit the amount | Tap "Dinner", change the amount to 600, tap **Save** | Each share is now ₹200: "Ben owes Asha ₹160.00" (₹200 − ₹40) and "Chitra owes Asha ₹100.00" (₹200 − ₹100) |
| M10 | Edit who paid | Tap "Dinner", set **Paid by** to Ben, **Save** | Ben paid ₹600 and his share is ₹200, so the others owe him: "Asha owes Ben ₹340.00" and "Chitra owes Ben ₹100.00" (Asha: −₹200 share, −₹40 and −₹100 received; Chitra: −₹200 share, +₹100 paid) |
| M11 | Edit the split | Tap "Dinner", **Change**, untick Chitra, **Done**, **Save** | ₹600 between Asha and Ben, ₹300 each: "Asha owes Ben ₹340.00" and "Asha owes Chitra ₹100.00" (Chitra's ₹100 payment to Asha now leaves Asha owing her) |
| M12 | An edit that changes nothing | Tap "Dinner", tap **Save** without changing anything | The sheet closes; nothing changes and no "waiting to sync" appears |
| M13 | Edit and delete a payment | Tap "Ben paid Asha" (₹40.00), change it to 50, **Save** | "Asha owes Ben ₹350.00", "Asha owes Chitra ₹100.00". Then tap it again, **Delete**, confirm: "Asha owes Ben ₹300.00", "Asha owes Chitra ₹100.00" |
| M14 | Settled up | Tap "Asha owes Ben ₹300.00", **Record payment**; then "Asha owes Chitra ₹100.00", **Record payment** | Balances say "All settled up." and "Nobody owes anybody."; Expenses lists "Asha paid Ben" and "Asha paid Chitra" as payments. (Deleting every entry instead brings back the guide's "Add the first expense") |

### People

| # | Test | Steps | Expected |
|---|---|---|---|
| P1 | Can't remove someone in an expense | Add "Lunch", ₹90, paid by Asha. Open People (tap the faces), tap **Remove** next to Ben | Under Ben: "Can't remove someone who appears in an expense. Delete their expenses first." Nothing is removed |
| P2 | Remove someone | Add "Dev" in People, tap **Remove** next to Dev | "Remove Dev from the group?" Tap **Remove**: Dev is gone; the header counts 3 people |

### Logging out, switching and removing a group

| # | Test | Steps | Expected |
|---|---|---|---|
| L1 | Logout | — | **Not in this app:** no accounts. The nearest things are L2 and L3 |
| L2 | Switch group | Group menu (the round ⋯ button, or tap the group's name) → **Switch group** | The welcome screen with **Your groups**: "Goa trip" and "Rounding test", most recent first, each "Opened …". Tap "Goa trip": it opens at once |
| L3 | Remove from this device | Open "Rounding test" and copy its invite link (group menu → **Copy invite link**). **Switch group**, tap **Edit**, then **Remove from this device** next to "Rounding test", then **Done** | The note "Removing a group only takes it off this device. The group itself isn't deleted, and its invite link still works." "Rounding test" is gone from the list. Open the copied link: the group comes back with its entries. Go back to "Goa trip" |
| L4 | Account deletion | — | **Not in this app:** no accounts ([PRIVACY_POLICY.md](PRIVACY_POLICY.md) section B). Deleting data is M4, P2 and L3 |

### Sharing, live sync and links

| # | Test | Steps | Expected |
|---|---|---|---|
| S1 | Copy the invite link | Group menu → **Copy invite link** | The row says "Copied" for a moment. The clipboard holds `https://splitfamilia.up.railway.app/index.html?g=goa-trip-…` (or `/?g=…`) |
| S2 | Live sync | On the computer, open the copied link. Add "Ice cream", ₹60, paid by Chitra, there | Within a few seconds the phone shows "Ice cream" and the new balances, and the computer shows the same |
| S3 | Deep link into the app | Send yourself the invite link (for example in a chat with yourself), tap it on the phone | It opens in the SplitFamilia app (if Android asks, choose SplitFamilia), straight into "Goa trip". Without the app installed, it opens in the browser |
| S4 | Join with a link | On the computer: welcome screen → **Join with a link**, paste the link, **Join** | "Checking…", then the group opens |
| S5 | Privacy policy | Welcome screen → **Privacy policy**; and group menu → **Privacy policy** | The policy opens inside the app, with "Back to SplitFamilia" at the end, which returns to the app (the group, if one was open). Until the owner approves it, a "Draft" note is at the top |

### Offline, slow network and errors

| # | Test | Steps | Expected |
|---|---|---|---|
| O1 | Offline change | In "Goa trip", turn on airplane mode | Under the title: "offline: changes will sync when you're back online" |
| O2 | | Still offline, add "Snacks", ₹90, paid by Ben | The row shows "waiting to sync"; the status says "offline: 1 change waiting to sync"; balances already include Snacks |
| O3 | | Still offline, tap "Snacks" and change it to ₹120, **Save**; then delete "Ice cream" | "offline: 3 changes waiting to sync" |
| O4 | Back online | Turn airplane mode off | Within a few seconds the status goes quiet (the white dot), "waiting to sync" disappears, and the computer shows Snacks at ₹120.00 and no Ice cream |
| O5 | Start offline | Close the app (swipe it away), turn on airplane mode, open it | "Goa trip" opens from the phone's copy, with the offline status. Turn airplane mode off: it syncs |
| O6 | First start offline | On the computer, in a new private window with the network off (DevTools → Network → Offline), open https://splitfamilia.up.railway.app | Nothing can load, so the browser's own offline page shows. (On a phone where the app has run once, O5 applies instead.) |
| O7 | Slow network | Section 2's throttling ("Slow 4G"), then open the group and add an expense | "Loading…" or "connecting…" for longer; the expense shows "waiting to sync" until the server confirms it, then once only (no duplicate) |
| E1 | Unknown group | Welcome screen → **Join with a link**, type "no such group here", **Join** | Under the field: "No group found with that code. Check it, or ask for the invite link." |
| E2 | Broken link | Open `https://splitfamilia.up.railway.app/?g=GOA` | The welcome screen with "That group link isn't valid." |
| E3 | A change another phone beat | On the phone (airplane mode on), edit "Lunch" to ₹120. On the computer, delete "Lunch". On the phone, tap **Add expense** (leave the sheet open) and turn airplane mode off | A red message bar **above the open sheet**: "Couldn't save the expense “Lunch”. Someone else changed or deleted it first, so this edit wasn't saved." Its × dismisses it. Lunch is gone on both |
| E4 | Session expiration | — | **Not in this app:** no sessions or tokens. An invite link never expires |

### Restart and the Android app

| # | Test | Steps | Expected |
|---|---|---|---|
| R1 | App restart | Android Settings → Apps → SplitFamilia → **Force stop**, then open it | "Goa trip" opens directly, with every entry |
| R2 | Restart with a change waiting | Airplane mode on, add "Water", ₹30; force stop; open (still offline) | "Water" is still there, "waiting to sync". Airplane mode off: it syncs |
| A1 | Full screen | Open the app | No browser address bar at the top, once `assetlinks.json` holds Play's app signing fingerprints and is deployed ([BUILD_RELEASE.md](BUILD_RELEASE.md) section 9). **Before that, an address bar is expected, not a failure** |
| A2 | No install button | Welcome screen, and the group menu | No "Install app" anywhere inside the app |
| A3 | Colours | Look at the top and bottom of the screen | Status bar indigo (`#4F46E5`, the header's colour), navigation bar white |
| A4 | Icon and name | The launcher | "SplitFamilia" with the owner's icon; on a round launcher the "S" isn't cut off |
| A5 | Back gesture | Open a sheet (Add expense), use Android's back gesture or button | The sheet closes. With no sheet open, back leaves the app (or goes back from the privacy policy) |
| A6 | Rotation on a tablet | On a tablet or unfolded foldable (pre-launch report, or a device you have) | The app may rotate (Android 16 ignores the portrait lock on large screens for apps that target API 36); the layout still works |
| N1 | Notifications | — | **Not in this app:** no notifications; the app asks for no permissions at all |

## 4. If a test fails

- Write down the test number, what you saw, the time (IST), the phone and its Android version,
  and whether the status said "live", "offline: …" or "not syncing". Never send a group's invite
  link to anyone outside the group (a Claude Code session doesn't need it).
- A1 only (address bar): check
  https://splitfamilia.up.railway.app/.well-known/assetlinks.json lists every app signing
  fingerprint Play Console shows. Then, in Android Settings → Apps → SplitFamilia → **Open by
  default**, "Open supported links" should be on with the address verified.
- The app doesn't start at all: look first at R8's mapping in the build
  (`android/app/build/outputs/mapping/release/`) for the class or resource it needed (the T-05
  review's note).
- Then ask a Claude Code session to look; a web fix reaches the app with the next Railway deploy,
  without a new Play upload.

## 5. Internal testing → Closed testing → Production

**MANUAL ACTION REQUIRED** throughout: a Claude Code session never uploads or changes anything in
Play Console. Setting up the account and testers: [PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md).

### Internal testing (you)

- **Who:** you, on your own phone; add more people only if you want to (up to 100, by email).
- **How:** Play Console → Test and release → Testing → **Internal testing** (VERIFY IN PLAY
  CONSOLE: the menu names) → create a release, upload `app-release.aab`, add release notes,
  roll it out. Create an email list of testers, then copy the **shareable link** and open it on
  your phone with the Google account on the list; install from the Play Store page it opens.
  "When you publish a new Android App Bundle to the internal test track, it becomes available to
  testers within minutes."
- **Then:** the first time, register Play's app signing fingerprints
  ([BUILD_RELEASE.md](BUILD_RELEASE.md) section 9) and ask a session to deploy them; reinstall
  isn't needed.
- **Check:** all of section 3 on your phone, and the pre-launch report. Internal tests "might not
  be subject to standard Play policy or security reviews", so passing here doesn't mean Play's
  review will pass.

### Closed testing (at least 12 testers for 14 days)

- **The rule (VERIFY IN PLAY CONSOLE):** "Developers with personal accounts created after
  November 13, 2023, must run a closed test for their app with a minimum of 12 testers who have
  been opted in continuously for at least 14 days" (checked 2026-10-02 IST). A tester who opts
  out before 14 days doesn't count, and one who leaves and rejoins starts again
  ([PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md) section 7). Aim for 15–20 testers.
- **Who:** people who agreed to test, each with a Google account ("Users need a Google Account
  or a Google Workspace account to join a test").
- **How:** Testing → **Closed testing** → create a track (or use "Alpha") → add testers by email
  list or Google Group → promote the internal release (or upload the same bundle) → roll it out.
  Share the **opt-in link**: each tester opens it, accepts, and installs from the Play Store on
  their own phone, by themselves. "Testers cannot leave public reviews on Google Play for test
  versions"; they can send private feedback through Google Play.
- **What to check during the 14 days:** the pre-launch report for each upload; Android vitals
  (crashes and "app not responding"); testers' private feedback; that the count of opted-in
  testers stays at 12 or more (VERIFY IN PLAY CONSOLE where Play shows it). Fix problems with
  web deploys where you can: those don't restart anyone's 14 days.
- **Then:** "When you meet these criteria, you can apply for production access on the Dashboard
  in Play Console". Play asks about the closed test (how you recruited testers, how they used the
  app, their feedback), about the app (audience, value, expected installs) and about production
  readiness (what changed after testing). Answer from what actually happened.

### Production

- **When:** after production access is granted, and every box in
  [PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md) is ticked.
- **How:** Testing results reviewed → Production → create a release with the tested bundle (the
  same `versionCode`, or a higher one if anything changed) → release notes → countries →
  **Send for review**. Play's review then decides.
- **Check after release:** install from the public store page on your phone and repeat I1, G1,
  M1, S3 and A1–A3; watch Android vitals for the first days.

## 6. Recording a test run

Keep a copy of this table per release (in the release's notes or a T-nn receipt). It holds no
names, links or group codes.

| Release | Date and time (IST) | `versionCode` / `versionName` | Build | Phone and Android version | Tests passed | Failures (test number, what was seen) |
|---|---|---|---|---|---|---|
| | | | Internal testing, Play-signed | | | |

## 7. Last dry run of this checklist

The steps and expected texts above were clicked through on the local site in headless Edge on
2026-10-02 (IST), at 360 px wide, by `docs/planning/evidence/T-06-browser-check.mjs`: results in
the [T-06 receipt](../planning/evidence/T-06-implementation.md), SF-019. The Android-only tests
(I1's splash, S3, R1, A1–A6) need the installed app and were not part of it.
