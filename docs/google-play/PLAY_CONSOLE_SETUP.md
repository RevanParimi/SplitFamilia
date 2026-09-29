# Setting up the Google Play developer account for SplitFamilia

This guide lists every step to create and verify the Google Play developer account and create
the app entry for **SplitFamilia**. Do the slow steps first: identity verification can take days,
and a new personal account must run a closed test for 14 days before it can publish.

**Nothing in this repository creates or changes the Play account.** The code only prepares files.
You do every Play Console action yourself.

How to read the labels:

- **MANUAL ACTION REQUIRED**: a step you do yourself, in Play Console or a Google account.
- **VERIFY IN PLAY CONSOLE**: depends on your own account or may have changed; check what Play
  Console shows you.
- **OWNER CONFIRMATION REQUIRED**: a choice only you can make.

Facts that change over time link the official page and say when they were checked. "Checked"
means read on that page on **2026-09-29 (IST)**.

## Decisions already made

| ID | Decision | Made on |
|---|---|---|
| D-1 | Package name (application ID): **`com.splitfamilia.app`**. It is neutral, so your personal name stays out of the Play URL and the phone's app info. | 2026-09-28 |
| D-2 | App name, on the store and inside the app: **SplitFamilia** (12 characters; the limit is 30). | 2026-09-28 |
| D-7 | Account type: **personal**. Its cost is the closed test below: 12 testers opted in for 14 continuous days before you can apply for production access (as of 2026-09-29; **VERIFY IN PLAY CONSOLE**). | 2026-09-28 |

## 1. Personal or organization account

Checked on [Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885).

- **Personal:** meant for personal use, such as students and hobbyists. It can still monetise.
  It needs a government ID for identity verification and access to an Android phone (see
  section 2).
- **Organization:** for a business or organisation. It **must** provide a **D-U-N-S number**
  and an official organisation document. It is required for some app types (financial, health,
  VPN, government); SplitFamilia is none of these.
- **Testing rule:** only new **personal** accounts (created after 13 November 2023) must run the
  12-tester, 14-day closed test before production. Checked on
  [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465).
  The organisation account does not have this rule.

You chose **personal** (D-7). Nothing more to decide here.

## 2. Create the account and verify your identity

Checked on [Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435)
and [Verify your developer identity information](https://support.google.com/googleplay/android-developer/answer/10841920).

1. **MANUAL ACTION REQUIRED:** Choose the Google account that will own the developer account.
   Use one you will keep for as long as the app exists. Section 3 recommends a separate brand
   email for what the store shows publicly.
2. **MANUAL ACTION REQUIRED:** Sign up from Play Console (linked from the "Get started" page
   above), choose **Personal**, and pay the **one-time registration fee of US$25** (checked;
   **VERIFY IN PLAY CONSOLE** for the amount shown in your currency). Google may ask for "a valid
   government ID and a credit card, both under your legal name".
3. **MANUAL ACTION REQUIRED:** Verify your identity with an **official government identity
   document**. Your legal name and address come from the linked Google Payments profile.
4. **MANUAL ACTION REQUIRED:** Verify the **developer email** (the one the store shows) with the
   one-time code Google sends.
5. **MANUAL ACTION REQUIRED:** Verify the separate **contact email and phone number** (Google
   uses these to reach you; the store does not show them).
6. **MANUAL ACTION REQUIRED:** **Device verification**, required for new personal accounts:
   install the Play Console app on an Android phone you use, sign in with the owner Google
   account and confirm the device when asked.
7. **VERIFY IN PLAY CONSOLE:** Wait until every verification shows as complete. You can't
   publish from an unverified account.

## 3. What the store shows publicly

Checked on [Required information to create a Play Console developer account](https://support.google.com/googleplay/android-developer/answer/13628312).

For a **personal** account, Google Play shows:

- your **developer name** (you choose it; it can be **"SplitFamilia"**);
- your **legal name**;
- your **country** (from your legal address);
- your **developer email address**.

Your full address is shown only if you monetise on Google Play. SplitFamilia is free and has no
purchases, so it is not shown. Your contact email and phone (step 5 above) are not shown.

**Recommendation for a low profile:**

- **OWNER CONFIRMATION REQUIRED:** Set the developer name to **SplitFamilia**, not your own name.
- **MANUAL ACTION REQUIRED:** Create a **separate email address just for SplitFamilia** and use it
  as the developer email. Anyone who opens the store listing can see it, so it should not be your
  personal inbox. Use the same address as the app's contact email (section 5) and for support.
- Your **legal name and country are still shown**. A personal account can't hide them. An
  organization account would show the organisation's legal name, address, email and phone
  instead, and it needs a D-U-N-S number.

## 4. The package name

Checked on [Configure the app module](https://developer.android.com/build/configure-app-module)
(Android Developers) and [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152).

- **Format:** at least two parts separated by dots; each part starts with a letter; only letters,
  digits and underscores. `com.splitfamilia.app` fits.
- **Unique:** no two apps on Google Play can share one. Play Console says package names "are
  unique and permanent" and "can't be deleted or re-used".
- **Permanent:** once the first app bundle is uploaded, it can never change. A different package
  name means a different app, with no reviews, installs or history carried over.
- **When it is set:** the package name is read from the first app bundle you upload (it comes
  from the Android project in T-05). Play Console does not ask for it when you create the app.
- **VERIFY IN PLAY CONSOLE:** If the first upload says `com.splitfamilia.app` is already taken,
  stop and choose another before anything ships (D-1).

## 5. Create the app entry

Checked on [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152)
and [Set up your app's prices](https://support.google.com/googleplay/android-developer/answer/6334373).

**MANUAL ACTION REQUIRED:** In Play Console, choose **Create app** and fill in:

| Field | Value for SplitFamilia | Note |
|---|---|---|
| App name | SplitFamilia | 30-character limit. |
| Default language | **OWNER CONFIRMATION REQUIRED** (the app's text is English, so English is the obvious choice) | |
| App or game | App | "You can change this later." |
| Free or paid | **Free** | Once an app is free it "can't be changed to paid". Choose carefully. |
| Contact email | The SplitFamilia email from section 3 | Shown to Play Store users. |
| Declarations | Developer Program Policies, US export laws, Play App Signing Terms of Service | Read them before you accept. |

The store listing text, graphics and Data safety answers come later (SF-015 and SF-016 prepare
drafts). The privacy policy comes from SF-017.

## 6. Play App Signing, the upload key and the app signing key

Checked on [Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).

There are two keys:

- **The app signing key** is held by Google. Google uses it to sign the APKs that phones
  download. For new apps, **Play App Signing is turned on automatically** with a key Google
  generates. You never hold this key.
- **The upload key** is yours. You sign each app bundle (`.aab`) with it before uploading, which
  proves the upload came from you. Google recommends that the two keys be different.

What this means for you:

1. **MANUAL ACTION REQUIRED (in T-05):** Create the upload key yourself, following the build guide
   that SF-014 writes. This repository will never create your real upload key or store it.
2. **MANUAL ACTION REQUIRED:** Keep the upload key file (`.jks`) and its passwords in two safe
   places outside this repository, for example a password manager plus an offline backup.
   The repository's `.gitignore` blocks keystores and key settings from being committed.
3. **If the upload key is lost or leaked,** you are "not locked out of your app".
   **MANUAL ACTION REQUIRED:** create a new upload key, export its certificate as a `.pem` file,
   and in Play Console go to **Protected with Play → Play Store protection → Manage Play app
   signing → Request upload key reset** (**VERIFY IN PLAY CONSOLE**: the menu path may have
   moved).
4. Because Google holds the app signing key, losing the upload key does not lose the app. If you
   ever opted out of Play App Signing and lost your own signing key, it "cannot be reset".
   Don't opt out.

The web app itself updates without a new upload, because SplitFamilia is a Trusted Web Activity
(D-0): the Android app opens the hosted site. You need a new upload only when the Android wrapper
changes.

## 7. Start recruiting testers now

A new personal account must run a **closed test with at least 12 testers opted in continuously
for at least 14 days** before it can apply for production access (checked on
[App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)).
Testers who opt out before 14 days don't count, and a tester who leaves and rejoins restarts
their 14 days. Recruiting takes time, so start before the Android build exists.

Checked on [Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334):
each tester needs a **Google account** (Gmail or Google Workspace), and each opts in through a link.

1. **MANUAL ACTION REQUIRED:** Ask family and friends who use Android. Aim for **more than 12**,
   for example 15 to 20, so one or two dropping out doesn't leave you below 12. (That margin is
   advice, not a Google rule.)
2. **MANUAL ACTION REQUIRED:** Collect the **email address of the Google account each person is
   signed into the Play Store with on their phone**.
3. **MANUAL ACTION REQUIRED:** Choose how to hold the list:
   - an email list in Play Console (you paste the addresses), or
   - a **Google Group** (`yourgroupname@googlegroups.com`) that testers join themselves; you add
     the group's address once.
4. **MANUAL ACTION REQUIRED:** Tell each tester what to expect: open the opt-in link, install
   SplitFamilia from the Play Store, and **stay opted in for at least 14 days**.
5. **MANUAL ACTION REQUIRED:** Keep the list outside this repository. Testers' emails are
   personal data and must not be committed.

The closed test itself starts after T-05 produces the signed app bundle. The release checklist
(SF-019) covers running it and applying for production.

## 8. Checklist

| # | Step | Label |
|---|---|---|
| 1 | Pick the owner Google account | MANUAL ACTION REQUIRED |
| 2 | Create a separate SplitFamilia email for the store | MANUAL ACTION REQUIRED |
| 3 | Sign up as **Personal** and pay the US$25 fee | MANUAL ACTION REQUIRED |
| 4 | Verify identity, developer email, contact email and phone, and an Android device | MANUAL ACTION REQUIRED |
| 5 | Set the developer name (recommended: SplitFamilia) | OWNER CONFIRMATION REQUIRED |
| 6 | Confirm every verification shows complete | VERIFY IN PLAY CONSOLE |
| 7 | Create the app: SplitFamilia, App, Free | MANUAL ACTION REQUIRED |
| 8 | Recruit 15–20 testers and collect their Play Store Google account emails | MANUAL ACTION REQUIRED |
| 9 | Create and back up the upload key (T-05, from SF-014's guide) | MANUAL ACTION REQUIRED |
| 10 | At the first upload, confirm `com.splitfamilia.app` is accepted | VERIFY IN PLAY CONSOLE |
