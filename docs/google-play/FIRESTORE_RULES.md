# Firestore rules

> **A stopgap since 2026-09-30.** The database is moving to Railway (tasks T-08 and T-09), and
> Firebase will be removed. Publishing these rules now only closes today's open database until
> the switch-over (decision D-15). This guide is retired in SF-038.

SplitFamilia has no sign-in. A group's code is its password: whoever has the invite link can
read and change that group. Today the database is open to anyone. These are the live rules the
owner pasted on 2026-09-30, and they are the rollback target:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groups/{groupId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

`firestore.rules` (SF-007) closes it down to what the app needs.

- **What the repository does:** the rules file, `firebase.json`, and tests.
- **What you do by hand:** deploy the rules, marked **MANUAL ACTION REQUIRED** below. Nothing in
  this repo changes the live database or its rules.

## 1. What the rules allow

Everything not listed is refused.

| Path | Allowed | Refused |
|---|---|---|
| `groups/{code}` | Read one group by its code. Create or change it only as `{ currency }`, 1–3 characters. | Listing all groups. Other fields. Deleting a group. |
| `groups/{code}/people/{id}` | Read and list. Add a person as `{ name }`, 1–60 characters. Delete. | Editing a person. Other fields. |
| `groups/{code}/expenses/{id}` | Read and list. Add an expense with exactly `date` (text), `desc` (1–200 characters), `amount` (a number above 0, at most 10,000,000), `paidBy` (text) and `split` (a list of 1–100 people). Delete. | Editing an expense. An amount such as `"lots"` or `0`. Other fields. |
| Any other path, and searches across all groups | — | Everything. |

A code must look like the ones the app makes: lowercase letters and digits joined by single
hyphens, at most 80 characters (the same rule as `group-code.js`). The family's current code fits
(D-9). The limits match the app: `MAX_AMOUNT_PAISE` in `money.js`, and the page's input lengths.
`npm test` fails if they drift apart.

Editing people and expenses stays refused until SF-022 and SF-023, which open exactly what they
need.

## 2. The emulator tests

`tests/rules/firestore-rules.test.js` checks every allowed case and every refused case against
Firebase's local emulator, under the project `demo-splitfamilia`. A `demo-` project can never
reach the real database.

**Status (2026-09-29): all 15 tests pass on the emulator**, and loosening a rule (for example
allowing a list of every group) makes a test fail. Results: T-03's implementation receipt. The
rules must still pass these tests after any change, before they are deployed. To run them on a
machine with Java 21 (for example Eclipse Temurin 21):

```
npm install
npm run test:rules
```

The first run downloads the Firestore emulator (about 130 MB) to
`%USERPROFILE%\.cache\firebase\emulators`. `npm test` (the everyday tests) doesn't need Java, an
install or the network.

If a run stops with "Change detected, updating rules..." and then "Failed to make request to
http://127.0.0.1:8080/…", the emulator's watcher reacted to a recent edit of `firestore.rules`
before the emulator was ready. That's a tool problem, not a rules failure. The emulator may still
be running: close it (the `java` process whose command line names
`cloud-firestore-emulator`), then run again. If the next run says "port taken", that leftover
process is the cause.

## 3. Deploy the rules

Do this only after the tests in section 2 pass, and after the web app with T-03 is live, so the
page's own input limits match the rules. Older copies of the page (GitHub Pages today) allow a
longer name or description; the rules would refuse those, and the old page shows a raw error.

1. **MANUAL ACTION REQUIRED: save today's rules.** Firebase console → project
   `splitfamilia-cf927` → **Firestore Database → Rules**. Copy the text somewhere safe. This is
   what a rollback returns to. The text as of 2026-09-30 is at the top of this guide.
2. **MANUAL ACTION REQUIRED: sign in and deploy**, from this folder, with the Google account that
   owns the Firebase project:

   ```
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project splitfamilia-cf927
   ```

   This counts as a deploy (CLAUDE.md §5). It changes only the rules, not the data.
3. **Check it (pending check PC-002).** Open the family group on the live site:
   - it loads, and the bar says "live";
   - adding a test expense works;
   - deleting it again works.
   If any of these fails, roll back (section 4) and tell the next session what the page said.

## 4. Roll back

**MANUAL ACTION REQUIRED:** Firebase console → **Firestore Database → Rules**. The editor keeps
earlier versions of the rules; pick the one from before the deploy and publish it. Or paste the
text you saved in step 3.1 and publish.
