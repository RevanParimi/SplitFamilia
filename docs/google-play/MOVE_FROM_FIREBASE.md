# Moving SplitFamilia from Firebase to Railway (SF-038)

This is the switch-over, in one planned sitting of about an hour. Afterwards the app, its data
and the Android app depend only on SplitFamilia's own server on Railway, and Firebase can be
deleted. Nothing is lost or entered twice: Firestore is made read-only before the copy, every
balance is checked to the paisa after it, and the new page ships only once the copy is there.

It replaces `FIRESTORE_RULES.md`, removed with the rest of Firebase in T-09.

- **What the repository does:** the server's import endpoint and the copy script
  (`scripts/move-from-firestore.mjs`), the new page, and the checks below.
- **What only you can do** is labelled **MANUAL ACTION REQUIRED**. Each push is a production
  deploy, so it waits for your word (CLAUDE.md §5); so does running the copy against the real
  database.

## Before you start

- T-09 has been accepted by a fresh review (STATE.json: T-09 `done`).
- Pick a quiet time. From step 3 until step 5, the old app can show the ledger but can't save
  anything: a change made then fails with "This group can't be opened. Check the invite link."
  (the old page's text for a refused write).
- **MANUAL ACTION REQUIRED: write down every group code**, one per line, in a file
  `data/move-codes.txt` in this folder. `data/` is ignored by git, so the codes never reach
  GitHub, and the session reads them without showing them. A phone's code is the `g=` part of
  its invite link ("Copy invite link"). Firestore holds three groups today (D-16: copy all
  three; you can delete test groups later).

## 1. Push the server's part first (push A)

The copy needs the server's import endpoint on Railway before the new page ships. So T-09 goes
out in two pushes. Push A changes the server only: the page, its files and the service worker
stay exactly as they are, so phones see no difference.

**MANUAL ACTION REQUIRED:** give the session the word to commit and push **push A**: exactly
these files, from the working tree:

- `server/api.js`, `server/db.js`, `server/server.js`, `server/main.js`
- `ledger-rules.js`
- `scripts/move-from-firestore.mjs`
- `tests/server-api.test.js`, `tests/server-db.test.js`, `tests/ledger-rules.test.js`,
  `tests/move-from-firestore.test.js`

With `HEAD` at `a8bffb8` plus only these files, `npm test` passed 155/155 and the image check
started the server as Railway would (T-09 implementation receipt).

The session then checks, as for PC-005: `/healthz` says `"storage":"volume"`, and
`POST /api/import` answers 404 (it's off until step 2).

## 2. Turn on the import endpoint

1. **MANUAL ACTION REQUIRED: make a token.** In this folder, run:

   ```
   node -e "require('fs').writeFileSync('data/import-token.txt', require('crypto').randomBytes(24).toString('base64url'))"
   ```

   That writes a random 32-character token to `data/import-token.txt` (ignored by git). Open
   the file yourself; don't paste its contents into the chat.
2. **MANUAL ACTION REQUIRED:** in Railway, open the SplitFamilia service → **Variables** → add
   `IMPORT_TOKEN` with that value → deploy the change. The deploy log then says "SplitFamilia
   server: the import endpoint is on. Remove IMPORT_TOKEN once the move is done." A token
   shorter than 24 characters leaves the endpoint off, and the log says so.

## 3. Make Firestore read-only

**MANUAL ACTION REQUIRED:** Firebase console → project `splitfamilia-cf927` → **Firestore
Database → Rules**. First copy the current text somewhere safe (that's what a rollback
restores). Then replace it with this and choose **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groups/{groupId}/{document=**} {
      allow read: if true;
    }
  }
}
```

The old page can still read every group, and the copy script reads the same way, but nothing
can change the data any more. This is a Firebase settings change, so it needs your word like
a deploy.

## 4. The dry run, then the copy

1. **The dry run** (it only reads). The session runs, on your word:

   ```
   node scripts/move-from-firestore.mjs --codes-file data/move-codes.txt
   ```

   The terminal shows one line per group: counts, a fingerprint of the balances, and whether the
   copy keeps them. Names, expenses and balances go to a report file in `data/` for you.
2. **OWNER CONFIRMATION REQUIRED: read the report.**
   - Every person's balance and the suggested payments should be what the app shows today.
   - "Expense left out" lines are expenses the app doesn't count today, such as an amount that
     isn't a number. They're shown in the old ledger with a warning. They aren't copied. Add
     any you still need again after the move.
   - "OVER THE LIMITS" or "The copy keeps every balance: NO" means stop here and decide with
     the session. Nothing has been copied yet.
3. **The copy.** On your word, the session runs:

   ```
   node scripts/move-from-firestore.mjs --import https://splitfamilia.up.railway.app --codes-file data/move-codes.txt --token-file data/import-token.txt
   ```

   It copies each group with its own IDs and whole-paise amounts, reads each group back from
   the server, and compares every balance with the dry run. It must end with "Every balance
   matches to the paisa." Running it again adds nothing new. If it says otherwise, don't go on:
   the old app still works (read-only), and nothing on phones has changed yet.

## 5. Push the page's part (push B)

**MANUAL ACTION REQUIRED:** give the session the word to commit and push everything else in
T-09: the page, its modules, the service worker (cache `splitsheet-v6`), the server's file
list, the Dockerfile, the removal of Firebase from the repo, and the docs.

Railway deploys the new page. GitHub Pages publishes the same commit, where the page shows
"SplitFamilia has moved" with a button to the same group on the Railway address.

The session then runs the pending checks: each group on the Railway address shows the dry run's
balances; a test expense is added and deleted; the old address shows the notice.

## 6. Turn the import endpoint off again

**MANUAL ACTION REQUIRED:** in Railway, delete the `IMPORT_TOKEN` variable and deploy. Then
delete `data/import-token.txt` and `data/move-codes.txt` from this folder. Keep the report until
step 8 if you like, then delete it too.

## 7. Move each phone

**MANUAL ACTION REQUIRED**, on each phone:

1. Open the app as usual. If it's the old copy from GitHub Pages, it shows "SplitFamilia has
   moved": tap **Open SplitFamilia**. (A phone that hasn't opened the app for a while may show
   the old page once, from its cache; the next open shows the notice.)
2. On the new address, install again: Chrome menu → **Install app** or **Add to Home screen**.
3. Remove the old home-screen icon.

A phone that already opens the Railway address (since 2026-09-29, PC-003) updates by itself on
its next open or two; it needs nothing. The Android app from Google Play (T-05) opens the
Railway address directly, so it never needs this step.

## 8. After the safety period (7 days, D-16)

When every phone has moved and nobody has asked for anything back:

1. **MANUAL ACTION REQUIRED: turn off GitHub Pages:** the GitHub repository → **Settings →
   Pages** → set the source to none (or **Unpublish**).
2. **MANUAL ACTION REQUIRED: delete the Firebase project:** Firebase console → the gear →
   **Project settings → General** → **Delete project**. This deletes the old copy of the data,
   and there's no way back to Firebase after it, by design.

D-12 (moving the app's files into `web/`) can go ahead after this.

## Roll back

Until step 8:

1. **MANUAL ACTION REQUIRED:** in Railway → **Deployments**, redeploy push A's deployment. The
   page goes back to the Firestore version; the server keeps the copied data, harmlessly.
2. **MANUAL ACTION REQUIRED:** in Firebase, publish the rules you saved in step 3. The rules
   live on 2026-09-30, which let anyone read and write every group, were:

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

3. On your word, the session reverts push B on `main`, so GitHub Pages serves the old page
   again.

Expenses added on Railway after the switch-over then have to be added again by hand. The
session can list them for you by reading each group from the server. That's why the safety
period is short and watched.
