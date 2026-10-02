# SplitFamilia privacy policy (draft) and the account-deletion question

Story SF-017 (task T-06), written on 2026-10-02 (IST) from the code as it stands after T-05, and
from the official pages cited below. The policy says only what the app does today.

- **What this file holds:** the policy text (section A), which `privacy.html` shows word for word
  (SF-018; `npm test` checks the two match); the answer to "does Play's account-deletion rule
  apply?" (section B); how the owner handles a deletion request (section C); a cross-check with
  the Play Console declarations (section D); where each statement comes from (section E); and
  notes for the owner before publishing (section F).
- **LEGAL/OWNER INPUT REQUIRED** marks a legal or business choice the code can't make. The draft
  names no law and claims compliance with none.
- **OWNER CONFIRMATION REQUIRED** marks a fact or commitment only the owner can confirm.
- **MANUAL ACTION REQUIRED** marks a step the owner does by hand.
- Placeholders: `<OWNER_OR_COMPANY_NAME>`, `<CONTACT_EMAIL>`, `<EFFECTIVE_DATE>`,
  `<JURISDICTION>` and `<RESPONSE_TIME>`.

**Status: draft.** The page carries a "Draft" banner until the owner approves the text and fills
in the placeholders (pending check PC-010). Change the policy here and in `privacy.html`
together.

Sources, all checked on 2026-10-02 (IST):
[Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111),
[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469),
[Railway logs](https://docs.railway.com/guides/logs) (fields and retention per plan),
[railway ssh](https://docs.railway.com/cli/ssh), and the Google Fonts FAQ's privacy section
(https://fonts.google.com/faq, "Privacy and Data Collection": Google receives the visitor's IP
address, the requested URL and HTTP headers including the user agent; the Fonts API "does not set
or log cookies"). Railway's backup retention (daily backups, kept 6 days) is from
[HOSTING_RAILWAY.md](HOSTING_RAILWAY.md) section 3a (checked 2026-09-30).

## A. The policy text

<!-- POLICY START: privacy.html shows exactly this text (tests/privacy.test.js). -->

### 1. Who we are

SplitFamilia is a shared-expense ledger offered by `<OWNER_OR_COMPANY_NAME>` ("we", "us"). It runs as a website at https://splitfamilia.up.railway.app and as an Android app that opens that website. This policy explains what information SplitFamilia handles, why, who receives it, how long it is kept and what you can do about it. **LEGAL/OWNER INPUT REQUIRED:** the name to show here.

Effective date: `<EFFECTIVE_DATE>`.

### 2. The short version

- There are no accounts. You never give us an email address, a phone number or a password.
- A group holds what its members type: people's names, expenses, payments recorded between them, and a currency symbol. Anyone who has the group's invite link can see and change it.
- That information is kept on SplitFamilia's own server, so every phone in the group sees the same ledger.
- There are no ads, no analytics, no crash reporting and no cookies. We don't sell your information or share it for advertising.
- SplitFamilia only records payments made elsewhere. It never moves money and doesn't connect to banks or payment apps.

### 3. Information you give us

There is no account information: SplitFamilia has no sign-up, sign-in or password, and never asks for an email address or a phone number.

The people in a group type the group's information:

- people's names, up to 60 characters each, written however the group likes (a first name or a nickname is enough);
- expenses: what each was for (up to 200 characters), the amount, the date and time, who paid and whom it is split among;
- payments recorded between people, such as "Ben paid Asha ₹100", with the amount and the date;
- the group's currency symbol.

Each group also has a code, which is part of its invite link. A new group gets a code with a long random part. The code works like a password for the group.

The server also records when each entry was added and, for a removed person or a deleted or edited expense, when that happened.

Anyone with the invite link can read every entry, so write only what the group needs.

### 4. Information kept on your phone

To work offline, the app keeps some information in your browser's storage for the SplitFamilia site:

- a copy of each group opened on the phone, and any changes still waiting to be sent;
- the group open now, and a list of up to 20 groups opened on the phone, with when each was last opened ("Your groups");
- the app's own files, so it can start without a connection.

This stays on the phone. "Remove from this device" (in "Your groups", under Edit) deletes a group's entry and the phone's copy of it; a change still waiting to be sent is still sent the next time a group is open in the app while online. Clearing the site's data in your browser deletes all of it.

### 5. Technical information

Every device that loads a web page sends its IP address and a description of its browser and device (the "user agent").

- Our hosting provider, Railway, records each request in its logs: the IP address, the user agent, the address requested and the result. When an invite link is opened, the address requested can include the group's code. Railway keeps these logs for 30 days, and we use them only to fix problems.
- SplitFamilia's server uses the IP address in memory only, to limit how many requests one address can make, so no one can guess group codes or flood a group. It keeps the address while a live connection from the app is open (the app keeps one open while a group is open, for live updates), and for at most 11 minutes after the last request from that address. It never stores or logs the address.
- The page's fonts come from Google Fonts, so each time the page loads, Google receives the device's IP address, the user agent and the site's address (not the group's). Google's privacy policy (https://policies.google.com/privacy) applies to that.

We don't use IP addresses to work out where anyone is.

### 6. How we use information

We use information only to run SplitFamilia: to keep one shared ledger for each group, work out who owes whom, keep every phone in the group up to date, and keep the service working and safe from abuse. We don't use it for advertising, and we don't sell it.

### 7. Where it is stored, and how it travels

- The groups are stored in a database on SplitFamilia's server, which runs on Railway in Railway's Southeast Asia (Singapore) region. Railway keeps a daily backup of that database for 6 days. **OWNER CONFIRMATION REQUIRED:** the region.
- Every connection uses HTTPS, which encrypts the information on its way between your phone and the server. A request over plain HTTP is redirected to HTTPS.

**LEGAL/OWNER INPUT REQUIRED:** whether to say more about information travelling from your users' countries to Singapore.

### 8. Who else receives information

- **Other members of your group:** everyone with the group's invite link sees everything in the group.
- **Railway** (https://railway.com), our hosting provider: it runs the server and stores the database, its backups and the request logs for us.
- **Google Fonts:** the IP address and browser details, as in section 5.

We can read the database too, and we do so only to keep the service running, to fix a problem or to handle your request. No one else receives the information, and we don't share it for advertising. **LEGAL/OWNER INPUT REQUIRED:** what to say about disclosure when the law requires it.

The Android app asks for no permissions and contains no analytics or advertising code. It shows the website in your phone's browser (usually Chrome), and that browser's own privacy policy covers the browser.

### 9. No ads, analytics, crash reporting or cookies

SplitFamilia shows no ads and uses no analytics, crash reporting, tracking or advertising ID. It sets no cookies and sends no notifications.

### 10. How long we keep it

- A group, with everything in it, is kept until we delete it at someone's request (section 12). Nothing is deleted automatically.
- Removing a person, or deleting or editing an expense, takes it off the group for everyone straight away. The server keeps the old entry, marked as deleted, until the whole group is deleted, so that a phone which was offline can't bring a deleted entry back.
- Railway's backups are kept for 6 days, and its request logs for 30 days. The server keeps an IP address in memory only while a live connection from the app is open, and for at most 11 minutes after the last request from it.
- On your phone, the information stays until you remove the group from the device or clear the site's data.

### 11. Accounts and account deletion

SplitFamilia has no accounts, so there is no account to create or delete. Section 12 explains how to delete information.

### 12. Deleting your information

In the app:

- **An expense or a payment:** tap it, tap Delete, then confirm. It disappears for everyone in the group (the server keeps it marked as deleted, as in section 10).
- **A person:** in People, tap Remove next to their name. Someone who is part of an expense can be removed only after their expenses are deleted.
- **A group on your phone:** in "Your groups", tap Edit, then "Remove from this device". The group stays for everyone else.

On request: email `<CONTACT_EMAIL>` with the group's invite link and what you would like deleted. We will delete the whole group from the server, including the entries marked as deleted, within `<RESPONSE_TIME>`, and reply when it is done. The backups that still hold it are gone within 6 days, and the request logs within 30 days. Copies on other people's phones stay until they remove the group from their device. **OWNER CONFIRMATION REQUIRED:** the response time, who may ask for a whole group to be deleted, and whether you will also delete a single entry on request.

### 13. Security

- Every connection uses HTTPS.
- The invite link is the key to a group: anyone who has it can see and change the group. Share it like a password, only with the people in the group.
- The server has no list of groups that anyone can browse, and it blocks an address that tries many wrong codes.
- Anyone who uses your phone can open the groups on it, so keep your phone locked.

### 14. Children

SplitFamilia is meant for adults (18 and over) sharing costs, and it is not directed at children. We don't knowingly collect information from children. If you think a child has entered information, contact us and we will delete it. **LEGAL/OWNER INPUT REQUIRED:** the age of consent that applies in `<JURISDICTION>`.

### 15. Your rights

**LEGAL/OWNER INPUT REQUIRED:** the laws that apply in `<JURISDICTION>`, and any rights or legal-basis statement they require. This draft names no law and claims compliance with none.

### 16. Changes to this policy

If this policy changes, the new version will be posted on this page with a new effective date. **OWNER CONFIRMATION REQUIRED:** whether to announce changes in the app as well.

### 17. Contact

Questions and requests: `<CONTACT_EMAIL>`. `<OWNER_OR_COMPANY_NAME>`, `<JURISDICTION>`.

<!-- POLICY END -->

## B. Does Play's account-deletion requirement apply? No.

Play's requirement, quoted from
[Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
(checked 2026-10-02 IST):

> If your app allows users to create an account from within your app, our User data policy
> requires that it must also allow users to request for their account to be deleted.

> If your app enables account creation, you must: provide users with an in-app path to delete
> their app accounts and associated data; and provide a web link resource where users can request
> app account deletion.

The same page adds that an app which offers account creation "in any part of the app experience"
must offer deletion "even if some features can be accessed without an account".

**Conclusion: not applicable.** SplitFamilia lets no one create an account anywhere:

- no sign-up, sign-in, password, email or phone field exists in the page (`index.html`), and the
  server has no user or account table (`server/db.js`: `groups`, `people`, `expenses`,
  `expense_split`, `schema_version`);
- a group's code is not an account: it belongs to no one, carries no profile or credentials of a
  person, and the server has no endpoint that lists groups (`server/api.js` header comment);
- "people" in a group are names typed by any member, not users who log in.

So Play Console's account-deletion fields don't apply, and nothing needs implementing for the
rule (the brief's stage 5 asked for a deletion flow only if accounts exist).

**Data deletion is a separate question.** Data safety asks whether users can request that their
data be deleted ([PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md), section 1). Today:

- in the app, a person or an expense can be removed, but the server keeps the row marked deleted
  (`server/db.js`, header comment), and a whole group can't be deleted (SF-024, stretch, would
  add that);
- on request, the owner can delete a whole group from the server by section C's steps.

The policy (section 12) offers deletion by email. If the owner prefers not to commit to that,
answer **No** to Play's deletion question and change sections 10 and 12 of the policy to match.

## C. Handling a deletion request (MANUAL ACTION REQUIRED, the owner)

**OWNER CONFIRMATION REQUIRED first:** the response time (`<RESPONSE_TIME>`; 30 days or less is
common), who may ask for a whole group to be deleted (for example anyone who has its link), and
whether to delete single entries on request.

There is no admin page: the group is deleted inside the running service, with Node's own SQLite
module. Deleting the group row deletes its people, expenses (including those marked deleted) and
their splits with it, because the tables cascade (`server/db.js`, migration 1) once
`foreign_keys` is on.

**Once, on your computer:** install the Railway CLI and sign in (`npm i -g @railway/cli`, then
`railway login`), and in any folder run `railway link` and pick the SplitFamilia project and
service. The first `railway ssh` asks to register an SSH key with your Railway account
([railway ssh](https://docs.railway.com/cli/ssh), checked 2026-10-02 IST). **VERIFY IN RAILWAY:**
the menus if they differ.

**For each request:**

1. Check the request names a group: an invite link (`https://splitfamilia.up.railway.app/?g=<code>`)
   or a code. The code is the part after `?g=`. Keep the email private: the code opens the group.
2. Open a shell in the running service: `railway ssh`. The prompt is inside the app's container,
   in `/app`.
3. Start Node: `node`. At the `>` prompt, paste these lines one at a time, with the code in place
   of `<GROUP_CODE>`:

   ```js
   const { DatabaseSync } = require("node:sqlite")
   const db = new DatabaseSync(process.env.RAILWAY_VOLUME_MOUNT_PATH + "/splitfamilia.db")
   db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON")
   const code = "<GROUP_CODE>"
   const count = () => db.prepare("SELECT (SELECT count(*) FROM groups WHERE code = ?) AS groups, (SELECT count(*) FROM people WHERE group_code = ?) AS people, (SELECT count(*) FROM expenses WHERE group_code = ?) AS expenses, (SELECT count(*) FROM expense_split WHERE group_code = ?) AS splits").get(code, code, code, code)
   count()
   ```

   The last line shows what the group holds, for example
   `[Object: null prototype] { groups: 1, people: 4, expenses: 5, splits: 9 }` (each other line
   answers `undefined`). `groups: 0` means there is no group with that code: check the code with
   the requester, and delete nothing.
4. Delete it, and check that nothing is left:

   ```js
   db.prepare("DELETE FROM groups WHERE code = ?").run(code)
   count()
   db.close()
   .exit
   ```

   The `run` line answers `{ changes: 1, lastInsertRowid: 0 }`, and `count()` now answers
   `{ groups: 0, people: 0, expenses: 0, splits: 0 }`. If `count()` still shows people or
   expenses, the `PRAGMA` line was skipped: run `db.exec("PRAGMA foreign_keys = ON")`, then
   `db.prepare("DELETE FROM expense_split WHERE group_code = ?").run(code)`,
   `db.prepare("DELETE FROM expenses WHERE group_code = ?").run(code)` and
   `db.prepare("DELETE FROM people WHERE group_code = ?").run(code)`, and `count()` again.
5. Type `exit` to leave the container. Then, in Railway's dashboard, **Restart** the service
   (Deployments → the active one → Restart; **VERIFY IN RAILWAY**). The server keeps each group's
   latest answer in memory to serve it quickly; a restart clears it and closes any live
   connection to the group. Phones still showing the group then see "No group found with that
   code. Check it, or ask for the invite link." (The restart costs a few seconds of downtime, as
   a deploy does.)
6. Reply to the requester: the group is deleted from the server; the backups that still hold it
   are gone within 6 days and the request logs within 30 days; copies on phones stay until each
   person uses "Remove from this device". A phone that still has the group could create a new,
   empty group with the same code by changing its currency, so suggest that everyone removes it.
7. Delete the request email once you have replied, unless you need to keep it (**OWNER
   CONFIRMATION REQUIRED**). Never put the code in the repository.

**Single entries.** Deleting one person or expense in the app already hides it from everyone. To
also erase entries marked deleted while keeping the group, ask a Claude Code session for the
exact lines (a `DELETE ... WHERE group_code = ? AND deleted_at IS NOT NULL` on `expenses` and
`people`, with the same `PRAGMA` line). The trade-off: a phone that was offline when the entry was
deleted could then add it again.

**Tested:** these lines were run in T-06 (2026-10-02 IST) against a local database made by the
real server (a group with people, expenses, a settle-up, an edit and a delete): before, the
counts; after, all zero; the API then answers 404 for the code; another group is untouched
([T-06 receipt](../planning/evidence/T-06-implementation.md), SF-017). `railway ssh` itself was
not run: the session has no access to the owner's Railway account.

## D. Cross-check with the Play Console declarations

Each data type in the policy, against [PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md)
section 0 ("Where the data goes") and section 1 (Data safety). Checked 2026-10-02 (IST): no
mismatch.

| Data | Policy | Declarations | Match |
|---|---|---|---|
| Account information (email, phone, password) | None (sections 2, 3, 11) | None ("Not created or sent anywhere"; section 10) | Yes |
| People's names | Section 3; kept until the group is deleted, removed ones marked deleted (10) | "People's names"; Data safety: **Name** | Yes |
| Expenses: description, amount, date, payer, split | Section 3 | "Expenses ..."; Data safety: **Other financial info**, **Other user-generated content** | Yes |
| When each entry was added, removed or replaced | Section 3 | Section 0, the expenses and people rows (added in T-06) | Yes |
| Settle-ups (payments recorded) | Sections 2, 3; never moves money | "Settle-ups"; Financial features: none | Yes |
| Currency symbol | Section 3 | "The group's currency symbol"; **Other user-generated content** | Yes |
| The group code | Section 3 (a password for the group); section 5 (can appear in Railway's logs) | "The group code"; not a User ID (owner to confirm) | Yes |
| The phone's copy and waiting changes | Section 4 | IndexedDB row; on the phone only | Yes |
| Current group and "Your groups" (20, with times) | Section 4 | `localStorage` row | Yes |
| The app's files on the phone | Section 4 | Not data about anyone (the service worker's cache holds no group data) | Yes |
| IP address and user agent: Railway's logs, 30 days | Section 5, 10 | The IP row; Railway HTTP logs 30 days (Pro) | Yes |
| IP address: the server's limits and live connections, memory only: while a live connection is open, and at most 11 minutes after the last request | Section 5, 10 | The IP row and "IP addresses": the same bound; never logged | Yes |
| IP address and user agent: Google Fonts | Sections 5, 8 | The IP row; Google Fonts until SF-025 | Yes |
| Storage place and backups | Section 7: Railway, Southeast Asia (Singapore); daily backups kept 6 days | "SQLite on a Railway volume in Southeast Asia (Singapore); daily volume backups kept 6 days" | Yes |
| Encryption in transit | Section 7: HTTPS; http redirected | Data safety: encrypted in transit, Yes; Railway redirects http to https | Yes |
| Third parties | Section 8: Railway (host), Google Fonts | Section 1: not shared; Railway a service provider; Google Fonts gets the IP | Yes |
| Ads, analytics, crash reporting, advertising ID, cookies, notifications | Section 9: none | Sections 4, 11; section 0: none of them | Yes |
| Android permissions and SDKs | Section 8: no permissions, no analytics or advertising code | Section 9: no permissions; section 1: no SDK that collects data | Yes |
| Retention | Section 10: until deleted on request; backups 6 days; logs 30 days | Section 1 "Retention" (owner confirmed 2026-10-02) | Yes |
| Account deletion | Section 11: no accounts | Section 10: not applicable | Yes |
| Data deletion on request | Section 12: by email | Section 1: Yes, by email (owner confirmed 2026-10-02) | Yes |
| Children and audience | Section 14: 18 and over; not directed at children | Section 6: 18 and over (owner confirmed 2026-10-02) | Yes |

## E. Where each statement comes from

| Policy section | Evidence |
|---|---|
| 1 | The host: [ANDROID_APPROACH.md](ANDROID_APPROACH.md) (D-10); the Android app opens it |
| 2 | Summarises 3 to 9; "never moves money": the Record payment sheet (`index.html`, "This only records a payment made outside the app") |
| 3 | `ledger-rules.js` (names 1–60, descriptions 1–200, currency up to 3 characters), `ledger-client.js` (what each change sends), `group-code.js` `newGroupId` (the random part), `server/db.js` (`created_at`, `deleted_at` columns) |
| 4 | `outbox.js` (`openBrowserStore`: `outbox` and `copies`), `recent-groups.js` (`MAX_RECENT` 20, `openedAt`), `index.html` (`splitsheet-group`; `removeRecent` deletes the copy and keeps the outbox; the outbox runs only inside an open group, `startApp`, and its `sendAll` sends every group's waiting changes), `service-worker.js` (`SHELL`) |
| 5 | [Railway logs](https://docs.railway.com/guides/logs) (fields `@srcIp`, `@clientUa`, `@path`; Pro 30 days); `server/api.js` `clientAddress` and the limiters (10-minute windows, in a `Map`; log lines without addresses; `sweep()`, run by `server/server.js` every `SWEEP_MS`, 30 seconds, so an address goes at most 10.5 minutes after its last event, and `tests/privacy.test.js` checks the policy's 11 minutes covers that); `server/live.js` (an address counted while its stream is open, dropped when it closes); `index.html` loads `fonts.googleapis.com`; the Google Fonts FAQ; `server/static.js` `Referrer-Policy: strict-origin-when-cross-origin` (other sites get only the origin) |
| 6 | The code sends the data nowhere but the app's own server (`tests/wiring.test.js`: the page names no other host but Google Fonts) |
| 7 | [HOSTING_RAILWAY.md](HOSTING_RAILWAY.md) section 3a (region, volume, backups; the owner's report of 2026-09-30); http to https (301), checked 2026-10-01 IST ([PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md) section 0) |
| 8 | As 5 and 7; Android: the merged release manifest (T-05 checks M1–M3, B3) |
| 9 | No ad, analytics or crash SDK or script (`tests/wiring.test.js` hosts check; [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md)); no `document.cookie` or `Set-Cookie` anywhere in the code; no Notification or Push API use |
| 10 | `server/db.js` (soft deletes; an edit marks the old row deleted); no expiry job exists; backups and logs as 5 and 7; IP addresses in the server's memory as 5 |
| 11 | Section B |
| 12 | `index.html` (`askDelete`, `removePerson` and its "Can't remove someone who appears in an expense" rule, `removeRecent`); section C |
| 13 | `server/api.js` header comment (no listing; 30 unknown codes per address per 10 minutes); `group-code.js` |
| 14 | [PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md) section 6 |
| 15–17 | Owner's input |

## F. Before publishing (notes for the owner)

- **Publish after PC-008** (2026-10-08 00:35 IST or later), when the old Firebase project is
  deleted. Until then a read-only copy of the groups made before the move (2026-10-01) still sits
  in Google's Firestore, which the policy doesn't mention. If you publish earlier, ask a session to
  add a sentence about it.
- **Fill in** the placeholders and resolve every LEGAL/OWNER and OWNER item, in this file and in
  `privacy.html` together, then ask a session to remove the "Draft" banner (PC-010).
- **Keep it true:** re-check the policy whenever the app changes what it sends or keeps. Known
  changes ahead: SF-025 (self-hosted fonts) removes Google Fonts from sections 5 and 8; SF-024
  (deleting a group in the app) changes section 12; `#g=` invite links (SF-035, owner's choice)
  would keep group codes out of Railway's logs (section 5); a Railway plan change alters the
  30-day log retention.
- **Your name:** a personal Play account shows your legal name on the store anyway
  ([PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md) section 3); whether the policy also needs it is
  a legal choice (LEGAL/OWNER INPUT REQUIRED).
