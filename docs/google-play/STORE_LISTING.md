# Google Play store listing draft (SF-015)

A ready-to-paste draft of SplitFamilia's main store listing, written from what the app does in
the code today (T-04, 2026-10-01 IST). Every claim is traced to the code in the table below; the
listing promises nothing the app doesn't do.

- What the code does is stated plainly.
- **MANUAL ACTION REQUIRED** marks what only the owner can do in Play Console.
- **VERIFY IN PLAY CONSOLE** marks what depends on the owner's account or Play's current forms.
- **OWNER CONFIRMATION REQUIRED** marks a choice the code can't settle.

Limits and rules were checked on 2026-10-01 (IST) in Play Console Help:
[Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152)
(name 30, short description 80, full description 4,000 characters) and the
[Metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842) (no
emoji or repeated special characters, no ranking or price claims such as "#1", "best" or "free",
no unattributed testimonials, no keyword stuffing). The graphics are in
[assets/README.md](assets/README.md).

**MANUAL ACTION REQUIRED:** in Play Console → your app → Grow users → Store presence → Main store
listing, paste the three texts below, upload the graphics from `assets/`, and save.

## App name

```text
SplitFamilia
```

12 characters of 30 (D-2: the same name in the store and inside the app).

## Short description

```text
Share trip and family costs with your group, and see who owes whom at a glance.
```

79 characters of 80.

## Full description

```text
SplitFamilia is a running ledger for shared costs. Start a group for a trip, a household or an occasion, add the people sharing costs, and log who paid for what. SplitFamilia works out who owes whom, as a short list of payments.

No sign-up and no accounts: send the group's private invite link to the others, and everyone with the link sees the same ledger, updated live.

What you can do
• Start a group in seconds, or join one with its invite link.
• Add everyone who's sharing costs, and remove anyone who isn't in an expense.
• Add an expense: what it was for, how much and who paid. It's split equally among everyone, or among the people you pick.
• Fix a mistake: tap an expense to change its description, amount, payer or split, or to delete it.
• See the balances: who owes whom, simplified into a short list of payments.
• Record a payment made outside the app, such as "Ben paid Asha ₹100", in full or in part. The balances update for everyone.
• Keep going offline: in a group already on your phone, changes made without a connection wait and sync when you're back online.
• Switch between your groups: the groups you've opened on this phone are one tap away.
• Choose the currency symbol each group shows.

Made for families and friends
• Amounts are kept exact to the paisa, so the balances always add up.
• A short guide helps a new group get started: add people, add the first expense, invite the others.
• Large, clear buttons, and it works on phones and tablets.

Good to know
• SplitFamilia only records what people paid. It never moves money and doesn't connect to banks or payment apps.
• Anyone with a group's invite link can see and change that group, so share the link only with the people in it.
• Expenses are split equally; there are no percentage or custom shares yet.
```

1,796 characters of 4,000, counted from this block (the T-04 receipt has the count).

## What each claim rests on

Line numbers are for the T-04 working tree (2026-10-01 IST); the reviewer checks each one.

| Claim in the listing | Where the code does it | How it was checked |
|---|---|---|
| Start a group; a private invite link | `index.html:952` (new group form), `group-code.js` `newGroupId` (a 50-bit random part), `index.html:1331` (`copyInvite`) | `tests/group-code.test.js`; browser check B12, B13 |
| Join with an invite link | `index.html:967` (join form), `group-code.js` `parseInvite` | `tests/group-code.test.js`, `tests/page-client.test.js` |
| No sign-up and no accounts | No sign-in code anywhere; the group code is the only key (`server/api.js` header comment) | `grep` finds no auth code; `docs/google-play/PRODUCTION_AUDIT.md` |
| Everyone with the link sees the same ledger, updated live | `index.html:1874` (`startWatch`), `ledger-client.js:155` (`watchGroup`), `server/live.js` | `tests/server-live.test.js`; browser check B12 (two tabs) |
| Add and remove people; not someone in an expense | `index.html:1918` (`addPerson`), `index.html:1937` (`removePerson`), `server/api.js` 409 `in-use` | `tests/server-api.test.js`; browser check B5 |
| Add an expense, split equally among everyone or the people picked | `index.html:1601` (`saveExpense`), the split list at `index.html:687`, `money.js:34` (`splitShares`) | `tests/money.test.js`; browser check B4, B13 |
| Change an expense's description, amount, payer or split, or delete it | `index.html:1439` (`openExpense`), `index.html:1618` (the edit), `index.html:1626` (delete, asks first), `server/api.js:411` (`PUT /api/expenses/<id>`) | `tests/server-api.test.js` (SF-022), `tests/outbox.test.js`; browser check B1–B3 |
| Who owes whom, as a short list of payments (largest debt paid first; not always the fewest) | `index.html:1200` (`renderBalances`), `money.js:52` (`computeBalances`), `money.js:75` (`simplifyDebts`) | `tests/money.test.js` |
| Record a payment made outside the app, in full or in part | `index.html:1638` (`openPay`), `index.html:1668` (records it as an expense marked `kind: "settlement"`), `ledger-rules.js:83` | `tests/server-api.test.js` (SF-023); browser check B4 |
| Never moves money; no banks or payment apps | The page's only network calls are its own `/api/` and Google Fonts (`tests/wiring.test.js`); the sheet says so at `index.html:721` | `tests/wiring.test.js` |
| Offline changes wait and sync when back online (in a group already on the phone) | `outbox.js:91` (`createOutbox`), `index.html:1778`; `service-worker.js` keeps the app's files | `tests/outbox.test.js`, `tests/service-worker.test.js`; browser check B2, B10, B12 |
| The groups opened on this phone are one tap away (the 20 most recent) | `index.html:1004` (`renderRecent`), `recent-groups.js:36` (`rememberGroup`, up to 20) | `tests/recent-groups.test.js`; browser check B7–B9 |
| A currency symbol per group | `index.html:1358` | `tests/server-api.test.js` |
| Exact to the paisa; balances add up | `money.js` (whole paise), `ledger-rules.js` (`amountPaise` integers) | `tests/money.test.js` (balances sum to 0) |
| A short guide for a new group | `index.html:1159` (`guideStep`), `index.html:1182` (`renderGuide`) | browser check B13 |
| Works on phones and tablets | The page's layout at 360–412 px and a two-column layout from 700 px | browser check B14 (360, 390, 412 and 768 px) |
| Anyone with the link can see and change the group | The code is the only key: `server/api.js` header comment | `tests/server-api.test.js` |
| Equal splits only | `money.js:34` (`splitShares`): equal shares only | — (SF-030, unequal splits, is a stretch story) |

Not claimed, because the app doesn't do it: accounts or sign-in, unequal or percentage splits,
payments of any kind, receipts or photos, notifications, reminders, export, ads-free or price
claims.

## Category

**Recommended: Finance. OWNER CONFIRMATION REQUIRED.**

- Play's Finance category covers money tools, including "tip calculators"
  ([Choose a category and tags](https://support.google.com/googleplay/android-developer/answer/9859673),
  checked 2026-10-01 IST). Shared-expense ledgers like this one are usually listed there, and
  people looking for "split expenses" look there.
- **Travel and Local** ("trip management tools") fits trips but not households or occasions.
- **Productivity** fits a ledger but says little about money.
- Finance doesn't change what the app must declare: every app answers the Financial features
  declaration (SF-016), and SplitFamilia's answer is that it only records payments made outside
  the app.

Tags: Play lets an app pick up to five from its own list. **VERIFY IN PLAY CONSOLE** which tags
are offered for the chosen category.

## Main features (for the listing and the release notes)

1. Shared groups with a private invite link; no accounts.
2. Expenses split equally among everyone or chosen people, exact to the paisa.
3. Edit or delete any expense.
4. Simplified balances: who owes whom, as a short list of payments.
5. Record full or part payments made outside the app.
6. Live sync between phones, and offline changes that sync later.
7. "Your groups": the groups opened on this phone, one tap away.

## Screenshots

Taken from the real app (SF-028's implemented UI, not the design mock-ups) with made-up people
and groups, by `docs/planning/evidence/T-04-store-shots.mjs`. Each is 1080 × 1920 (9:16), a
24-bit PNG with no alpha. Upload them in this order:

| Order | File in `assets/phone-screenshots/` | Shows (the card's list) |
|---|---|---|
| 1 | `01-your-groups.png` | The join screen: Your groups, Start a new group, Join with a link |
| 2 | `02-balances.png` | The balances: who owes whom |
| 3 | `03-add-expense.png` | Adding an expense |
| 4 | `04-expenses.png` | The ledger, with a payment row |
| 5 | `05-record-payment.png` | Recording a payment |
| 6 | `06-people.png` | People |
| 7 | `07-settled.png` | "All settled up." |

The design mock-ups in `docs/design/playstore-mockups/` are not screenshots of the app: don't
upload them. Each screenshot shows only the app's own screen, with no device frame or added text,
as Play asks.

## Contact details and privacy policy

**MANUAL ACTION REQUIRED:** in Play Console → Grow users → Store presence → Store settings
(VERIFY IN PLAY CONSOLE: where your account shows these):

- Email address (required): `<SUPPORT_EMAIL>`
- Website (optional): `<SUPPORT_WEBSITE>`
- Privacy policy (in App content → Privacy policy): `<PRIVACY_POLICY_URL>`. It exists only once
  SF-017 (the policy) and SF-018 (its page on the site) are done.

**OWNER CONFIRMATION REQUIRED:** which email and website to show. The owner keeps their personal
name out of public IDs and store text, so a dedicated support address is a good fit.

## Before the listing goes live

- The app icon is the owner's own image (D-19, answered 2026-10-01), ready as `icon-512.png`
  (see [assets/README.md](assets/README.md)).
- Re-check this listing against the code if T-05 or T-06 change what the app does.
