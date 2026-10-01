# Play Console declarations, answered from the code

Prepared answers for every declaration on Play Console's **App content** page (Policy and
programs → App content). Story SF-016 (task T-05), from the code as it stands after T-05
(2026-10-01 IST). Each answer rests on what the code does, with the file and line.

- **What the code does** is stated plainly, with evidence.
- **OWNER CONFIRMATION REQUIRED** marks what only the owner can decide or knows.
- **VERIFY IN PLAY CONSOLE** marks what depends on the account or on Play Console's current
  wording.
- **MANUAL ACTION REQUIRED:** filling in every form in Play Console is the owner's. A Claude Code
  session never changes Play Console.

Re-check these answers whenever the app changes what it sends, stores or asks for (for
example SF-024 deleting a group, SF-025 self-hosted fonts, or a new Android permission).

Sources (all checked 2026-10-01 IST):
[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) (Google's
definitions and data types), [Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455)
(the App content list), [Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271),
[Railway logs](https://docs.railway.com/guides/logs) (HTTP logs and retention).

## 0. The facts every answer rests on

SplitFamilia is a shared-expense ledger: people in a group, expenses (who paid, how much, split
among whom) and settle-ups (who paid whom back, outside the app). There is no sign-in. A group
is opened by its code, from a private invite link (`?g=<code>`) or typed in. The Android app is
a Trusted Web Activity: it shows the website https://splitfamilia.up.railway.app inside Chrome
(or another browser that supports it). The app itself has **no SDK that collects data, no
Android permissions** (the merged release manifest; [ANDROID_APPROACH.md](ANDROID_APPROACH.md)),
no ads, no analytics, no crash reporting, no push notifications, no location, no camera, no
contacts and no payments.

### Where the data goes

| Data | Typed by | Sent to | Stored | Who can see it | Deleted? |
|---|---|---|---|---|---|
| People's names ("Asha") | a group member | the app's own server on Railway | SQLite on a Railway volume in **Southeast Asia (Singapore)**; daily volume backups kept 6 days | everyone who has the group's code | "Remove" marks a person removed; the row stays |
| Expenses: description ("Dinner"), amount in paise, date, who paid, who shares it | a group member | the same server | the same | everyone with the code | "Delete" marks it deleted, and an edit replaces it with a new row; the old rows stay |
| Settle-ups: who paid whom, the amount, the date | a group member | the same server | the same, as an expense marked `settlement` | everyone with the code | as expenses |
| The group's currency symbol ("₹") | the person starting the group | the same server | the same | everyone with the code | stays with the group |
| The group code | made by the app (new groups: random) or typed in | the same server, in the `X-Group-Code` header of every request | the group's key in the database | whoever has the link | stays with the group |
| The phone's copy of its group and its waiting changes | (the app) | nowhere: on the phone only | the browser's IndexedDB for the site (`splitfamilia`) | the phone | "Remove from this device" deletes it |
| The current group and "Your groups" (up to 20 codes with when each was last opened) | (the app) | nowhere | the browser's `localStorage` (`splitsheet-group`, `splitfamilia-recent`) | the phone | "Remove from this device", or clearing the site's data |
| The device's IP address and browser (user agent) | (sent with every web request) | Railway (the host), and Google Fonts | Railway's HTTP logs: IP, user agent, path, status; 30 days on the Pro plan. The server itself keeps an address only in memory, up to 10 minutes, to enforce its limits, and never logs it | the owner (Railway dashboard); Google | Railway deletes logs after its retention period |

Not created or sent anywhere: email addresses, phone numbers, accounts or passwords, contacts,
location, photos, files, payment details, device identifiers, advertising ID, crash or usage
analytics.

### Cross-check: each data type and the code that sends or keeps it

| Data | Code |
|---|---|
| Person: `{ id, name }` (name 1–60 characters) | [ledger-client.js:67](../../ledger-client.js#L67); checked by [ledger-rules.js:73-77](../../ledger-rules.js#L73-L77); stored in `people` ([server/db.js:34-41](../../server/db.js#L34-L41)) |
| Expense and settle-up: `{ id, date, desc, amountPaise, paidBy, split[, kind] }` (description 1–200 characters) | [ledger-client.js:69-70](../../ledger-client.js#L69-L70); [ledger-rules.js:84-100](../../ledger-rules.js#L84-L100); stored in `expenses` and `expense_split` ([server/db.js:42-64](../../server/db.js#L42-L64)) |
| Currency: `{ currency }` | [ledger-client.js:66](../../ledger-client.js#L66); [ledger-rules.js:66-70](../../ledger-rules.js#L66-L70); `groups.currency` ([server/db.js:28-33](../../server/db.js#L28-L33)) |
| Group code, in a header, never in an API URL | [ledger-client.js:9](../../ledger-client.js#L9); [server/api.js:41](../../server/api.js#L41) |
| Removing a person ("Remove", [index.html:1390](../../index.html#L1390)) or deleting an expense keeps the row | [server/db.js:122](../../server/db.js#L122), [server/db.js:143](../../server/db.js#L143) |
| The client's address, for the limits only (in memory) | [server/api.js:129-135](../../server/api.js#L129-L135); limits [server/api.js:49-55](../../server/api.js#L49-L55) |
| The server's own log lines: method, status, error code; never an address or a code | [server/api.js:251](../../server/api.js#L251), [server/api.js:372-378](../../server/api.js#L372-L378), [server/api.js:439](../../server/api.js#L439) |
| On the phone: `localStorage` keys | [index.html:873](../../index.html#L873), [recent-groups.js:7](../../recent-groups.js#L7) |
| On the phone: IndexedDB `splitfamilia` (`outbox`, `copies`) | [outbox.js:198-202](../../outbox.js#L198-L202) |
| Google Fonts (the device's IP and user agent go to Google on each page load, until SF-025) | [index.html:15-16](../../index.html#L15-L16) |
| HTTPS: Railway redirects `http://` to `https://` (301; checked 2026-10-01 IST), and the app only opens `https://` | the Android link filter is `https` only ([ANDROID_APPROACH.md](ANDROID_APPROACH.md)) |

## 1. Data safety

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | Groups, people, expenses, settle-ups, the phone's offline copy, "Your groups" (section 0) |
| 2 | Data collected | **Name** (people's names), **Other financial info** (amounts, who paid, who owes whom), **Other user-generated content** (expense descriptions, the currency symbol). The IP address: see "IP addresses" below |
| 3 | Why | App functionality only: to keep one shared ledger for everyone in the group, on every phone |
| 4 | Leaves the device? | Yes, to the app's own server on Railway (Railway is the host, a service provider) |
| 5 | Shared with third parties? | No. Railway processes it on the developer's behalf (Play: a service provider is not "sharing"). Google Fonts receives the IP address, not any of the data above |
| 6 | Encrypted in transit? | Yes: HTTPS only |
| 7 | Can users delete it? | Not by themselves on the server: removing and deleting only mark rows. On the phone, yes ("Remove from this device"). **OWNER CONFIRMATION REQUIRED** below |
| 8 | SDKs | None that collect data. The Android app uses Android Browser Helper and AndroidX (no data collection); the page uses no SDK. Google Fonts is a web resource, not an SDK |
| 9 | Likely selections | The form below |
| 10 | Owner to confirm | Deletion requests, IP addresses, the group code (below) |

**The form (likely selections):**

- Does your app collect or share any of the required user data types? **Yes.**
- Is all of the user data collected by your app encrypted in transit? **Yes.**
- Do you provide a way for users to request that their data is deleted? **OWNER CONFIRMATION
  REQUIRED.** Recommended: **Yes**, by email to the support address, *if* you commit to doing
  it: on request, delete the group's rows from the database (a session can write the exact
  command; SF-024, deleting a group from the app, is a stretch story). Otherwise **No**. Play
  shows this answer on the store page.
- Account creation: the app has no accounts (Play asks for an account-deletion URL only from
  apps that let users create an account).

| Data type (Play's category → type) | Collected | Shared | Processed ephemerally | Required or optional | Purposes |
|---|---|---|---|---|---|
| Personal info → **Name** ("how a user refers to themselves, such as their first or last name, or nickname") | Yes | No | No | Required (an expense needs people) | App functionality |
| Financial info → **Other financial info** ("any other financial information such as user salary or debts") | Yes | No | No | Required | App functionality |
| App activity → **Other user-generated content** ("any other user-generated content not listed here") | Yes | No | No | Required (an expense needs a description) | App functionality |

Everything else (location, contact info, personal identifiers beyond names, photos, files,
health, messages, device IDs, app activity, web browsing, audio, calendar, contacts): **not
collected**.

**IP addresses. OWNER CONFIRMATION REQUIRED.** Play has no "IP address" type; it says to
disclose IP addresses "based on their particular usage". The code uses them only to enforce
limits (in memory, up to 10 minutes, never stored or logged by the server), and never to work
out a location. Railway's HTTP logs record them for 30 days (Pro), for the owner's own
troubleshooting. Recommended: declare no data type for them, and say so in the privacy policy
(SF-017). Google Fonts receives them from every page load until SF-025 self-hosts the fonts;
doing SF-025 before release removes that third party entirely.

**The group code. OWNER CONFIRMATION REQUIRED.** Play's "User IDs" are "identifiers that relate
to an identifiable person". A group code identifies a shared group, not a person or a device,
so the recommendation is not to declare it. Note: old-style codes made from a group's name
(such as the family's existing group) are guessable (D-4, N-3); new groups get random codes. The
server allows 30 unknown codes per address per 10 minutes.

**Retention. OWNER CONFIRMATION REQUIRED.** Groups and their rows are kept until deleted by
hand (no automatic expiry). Daily volume backups are kept 6 days. Railway's logs, 30 days.

## 2. Privacy policy

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | All of section 0 |
| 2–7 | Data | As in Data safety |
| 8 | SDKs | None that collect data; Google Fonts (until SF-025); Railway (host) |
| 9 | Likely selection | Play requires a privacy policy URL. Planned: `https://splitfamilia.up.railway.app/privacy.html` (SF-017 writes it, SF-018 serves it; T-06) |
| 10 | Owner to confirm | **OWNER CONFIRMATION REQUIRED:** the support email the policy names, and the deletion answer above. **MANUAL ACTION REQUIRED:** paste the URL in App content → Privacy policy once it is live |

## 3. App access

Play may call it **Sign-in details** (VERIFY IN PLAY CONSOLE).

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | No sign-in, no paywall, no location or membership checks |
| 2–7 | Data | None needed to review |
| 8 | SDKs | None |
| 9 | Likely selection | **All functionality in my app is available without any access restrictions.** Optionally add the instructions from [REVIEWER_ACCESS.md](REVIEWER_ACCESS.md) |
| 10 | Owner to confirm | Whether to give reviewers a pre-filled demo group: `<PLAY_REVIEWER_GROUP_LINK>`. The link opens a real group, so it goes only into Play Console, **never into git** |

## 4. Ads

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | No ads anywhere: no ad SDK, no ad network script on the page |
| 2–7 | Data | None |
| 8 | SDKs | None |
| 9 | Likely selection | **No, my app does not contain ads** |
| 10 | Owner to confirm | Nothing, unless ads are planned |

## 5. Content rating (IARC questionnaire)

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | A ledger. Group members see each other's names and expense descriptions (free text) inside a private group opened by its link |
| 2–7 | Data | As in Data safety |
| 8 | SDKs | None |
| 9 | Likely selections | Category **"All other app types"** (Utility, Productivity, Communication, or Other; VERIFY IN PLAY CONSOLE: the exact label). Violence, fear, sexuality, language, controlled substances, crude humour, gambling: **No**. **Users can interact or exchange content: Yes** (members of a group see what others type: names, descriptions); no chat, no public profiles, no strangers (only people with the link). Shares the user's location: **No**. Digital purchases: **No**. Unrestricted web access: **No** (the app shows only its own site). Expected result: an "Everyone" / 3+ rating with a "Users Interact" note; the questionnaire decides |
| 10 | Owner to confirm | **OWNER CONFIRMATION REQUIRED:** the "users interact" answer (recommended **Yes**, since descriptions are free text that others see) and the contact email IARC asks for |

## 6. Target audience and content

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | Splitting shared costs on trips and occasions: written for adults managing money |
| 2–7 | Data | As in Data safety; no data from or about children is sought |
| 8 | SDKs | None |
| 9 | Likely selection | **18 and over** (recommended); "appeals to children": **No**. Including any age under 13 brings in Play's Families policy and its extra requirements |
| 10 | Owner to confirm | **OWNER CONFIRMATION REQUIRED:** the target age groups. Teenagers on a family trip may use it; if you include 13–17, say so, and keep under-13 out |

## 7. Financial features

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | Records and calculates shared costs only. A settle-up ("Ben paid Asha ₹100") only records a payment made **outside** the app; the Record payment sheet says "This only records a payment made outside the app. SplitFamilia never moves money." |
| 2 | Data | Amounts and who owes whom (Data safety: Other financial info) |
| 3 | Why | To show balances and the payments that settle them |
| 4–7 | | As in Data safety |
| 8 | SDKs | No payment, banking, billing or wallet SDK; no Play Billing (none in the merged manifest) |
| 9 | Likely selection | **My app doesn't provide any financial features.** None of Play's listed features applies: no banking or loans, no payments, transfers or wallets, no "buy now, pay later" or rewards, no trading, crypto or crowdfunding, no credit monitoring, financial advice or insurance |
| 10 | Owner to confirm | **OWNER CONFIRMATION REQUIRED:** this selection (the list's "Other" under support services is the only alternative; it doesn't fit record-keeping) |

## 8. Health apps

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | No health or fitness features |
| 2–8 | | No health data; no health SDK; no Health Connect |
| 9 | Likely selection | **My app does not have any health features** |
| 10 | Owner to confirm | Nothing |

## 9. Sensitive permissions (permissions declaration forms)

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | The Android app requests **no permissions** (merged release manifest; checks M1–M3 and B3 in `docs/planning/evidence/T-05-android-checks.mjs`) |
| 2–7 | | No permission-protected data |
| 8 | SDKs | Android Browser Helper and AndroidX; AndroidX adds only its app-private `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (signature level) |
| 9 | Likely selection | No form to fill: no SMS, call log, location, all-files, photo and video, exact alarm, full-screen intent, foreground service, accessibility or query-all-packages permission |
| 10 | Owner to confirm | Nothing. If Play asks, VERIFY IN PLAY CONSOLE against the uploaded bundle |

## 10. Account creation and deletion

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | No accounts, no sign-in, no passwords |
| 2–7 | | No account data |
| 8 | SDKs | None |
| 9 | Likely selection | Not applicable: Play's account-deletion requirement covers apps that let users create an account. (Data deletion is answered in Data safety) |
| 10 | Owner to confirm | Nothing |

## 11. Advertising ID

| # | Question | Answer |
|---|---|---|
| 1 | Functionality | Never reads an advertising ID |
| 2–7 | | None |
| 8 | SDKs | None that use it; no `com.google.android.gms.permission.AD_ID` in the merged manifest (the app targets API 36, where the ID needs that permission) |
| 9 | Likely selection | **No**, my app does not use an advertising ID |
| 10 | Owner to confirm | Nothing |

## 12. News apps

| # | Question | Answer |
|---|---|---|
| 1–8 | | Not a news or magazine app |
| 9 | Likely selection | **No** |
| 10 | Owner to confirm | Nothing |

## 13. Government apps

| # | Question | Answer |
|---|---|---|
| 1–8 | | Not developed by or for a government |
| 9 | Likely selection | **No** |
| 10 | Owner to confirm | Nothing |

## 14. Any other declaration Play Console lists

Play's [Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455)
page (checked 2026-10-01 IST) also lists **COVID-19 contact tracing and status apps**: answer
**No** (not such an app). The permission-based forms (section 9) apply to none. **VERIFY IN PLAY
CONSOLE:** the App content page shows the exact list for your account; answer anything new from
section 0, or ask a session to add it here.

## 15. Everything the owner must confirm

1. Data deletion requests: offer them by email (recommended, if you commit to it) or answer No.
2. IP addresses: not declared as a data type (recommended), and named in the privacy policy.
3. The group code: not declared as a User ID (recommended).
4. Retention: kept until deleted by hand; backups 6 days; Railway logs 30 days.
5. The support email (Play, the privacy policy and IARC all ask for it); keep your own name out.
6. Content rating: "users interact" = Yes (recommended).
7. Target audience: 18 and over (recommended), or include 13–17.
8. Financial features: "My app doesn't provide any financial features".
9. Whether to give reviewers a demo group link (Play Console only, never git).
10. Whether to self-host the fonts first (SF-025, stretch), which removes Google Fonts from every
    answer.
