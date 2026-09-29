# Hosting SplitFamilia on Railway

The web app will run as a Railway service at one HTTPS address, for example
`https://splitfamilia.up.railway.app`. The Android app (SF-012) opens that address, so it must
be live before the Android work starts (task T-05).

- **What the repository does** (done in T-03, SF-011): the files that build and serve the app.
- **What you do by hand:** every step marked **MANUAL ACTION REQUIRED** below. Nothing in this
  repo creates or changes anything in Railway, GitHub or Firebase.

Decisions behind this: D-3 (Railway, like StockAgent), D-5 (a push to `main` deploys), D-10 (the
free `*.up.railway.app` address). See `docs/planning/STATE.json`.

## 1. What is in the repository

| File | What it does |
|---|---|
| `Dockerfile` | Builds a small image from `caddy:2.11.4-alpine` holding only the app's files: `index.html`, `manifest.json`, `service-worker.js`, the three JS modules, the icons and `.well-known/assetlinks.json`. No docs, tests, tooling or Firebase settings. |
| `.dockerignore` | Lets only those files (and the `Caddyfile`) into the build, as a second guard. |
| `Caddyfile` | The web server's settings: listens on `$PORT` (8080 if unset), serves `/.well-known/…`, compresses responses, and sets the headers below. Railway handles HTTPS in front of it. |
| `railway.json` | Railway's settings as code: build with the `Dockerfile`, check `/` after each deploy, restart on failure, and redeploy only when an app file changes (a docs-only commit doesn't redeploy). Railway reads it from the repo; it overrides the same settings in the dashboard. |
| `.well-known/assetlinks.json` | Tells Android that the SplitFamilia app (`com.splitfamilia.app`) may open this site full screen. Its two fingerprints are placeholders for now (see section 5). |

Headers on every file: `Cache-Control: no-cache` (a phone checks for a new version each time it
opens the app; an unchanged file costs a quick "not modified"), `X-Content-Type-Options: nosniff`
and `Referrer-Policy: strict-origin-when-cross-origin`. `assetlinks.json` is sent as
`application/json`.

`npm test` checks that the image ships every file the service worker caches, and that no shipped
file has an `http://` or `localhost` address.

How it was tested (T-03): the real Caddy server with this `Caddyfile`, on exactly the files the
`Dockerfile` copies. Every header above was present, and `docs/`, `tests/`, `package.json` and
the rules returned 404. Docker isn't installed on the development machine, so **the image itself
was not built**. Railway's first build is the first real build; if it fails, its build log says
why.

## 2. Before you start

- **MANUAL ACTION REQUIRED: put T-03 on `main` first.** Railway builds whatever is on `main`. If
  you connect the repo before the `Dockerfile` is there, Railway builds the repo without it and
  fails. Committing and pushing need your word (CLAUDE.md §5), and a push to `main` also updates
  today's GitHub Pages site.
- Use the Railway account that holds your other projects (the Pro workspace, like StockAgent),
  and the empty SplitFamilia project you created there.

## 3. Create the service

Railway's screens change from time to time. If a button has another name, look for the same
setting nearby.

1. **MANUAL ACTION REQUIRED: connect the repo.** In the SplitFamilia project, choose **Create**
   (or **+ New**) → **GitHub Repo** → the SplitFamilia repository. If Railway asks for access to
   GitHub, allow it for this repository only.
2. **MANUAL ACTION REQUIRED: deploy from `main` on every push.** In the service's
   **Settings → Source**, check the branch is `main` and automatic deploys are on. This is D-5:
   from now on, every push to `main` is a production deploy.
3. **MANUAL ACTION REQUIRED: set the port.** In **Variables**, add `PORT` with the value `8080`.
   The server listens there, and the address in step 4 sends traffic there.
4. **MANUAL ACTION REQUIRED: make the address.** In **Settings → Networking → Public
   Networking**, choose **Generate Domain**. If it asks for a port, enter `8080`. If Railway lets
   you edit the name, use `splitfamilia` (so the address is `https://splitfamilia.up.railway.app`).
   If that name is taken, pick another without your own name in it.
   - Tell the next session the exact address. It is built into the Android app and into every
     invite link, so it should not change after the Play release (D-10).
5. Wait for the deploy to finish. The build log should end with Caddy starting, and the health
   check on `/` should pass.

## 4. Check it (pending check PC-003)

With `<host>` as the address from step 4:

1. Open `https://<host>/` on a computer. The SplitFamilia start screen appears.
2. Open `https://<host>/.well-known/assetlinks.json`. It shows the JSON with
   `com.splitfamilia.app`.
3. Open the family group's invite link with `<host>` in place of the old address (keep the same
   `?g=` part). The ledger loads, and the bar says "live".
4. Add a test expense and delete it again. Both work.
5. Optional: in the browser's developer tools (Network tab), click `index.html` and check the
   response headers: `cache-control: no-cache`, `x-content-type-options: nosniff`.

Tell the next session the result. It records it under PC-003 in `docs/planning/STATE.json`.

## 5. The Android fingerprints (later, in T-05 and after the first Play upload)

`assetlinks.json` holds two placeholders. Both values are public, not secret:

- `<UPLOAD_KEY_SHA256>`: the SHA-256 fingerprint of your upload key, from
  `keytool -list -v -keystore <your upload keystore>`. SF-013 explains how.
- `<PLAY_APP_SIGNING_SHA256>`: the SHA-256 fingerprint of the key Google signs the app with.
  **VERIFY IN PLAY CONSOLE:** after the first upload, it is under your app → **Test and release
  → App integrity → App signing**.

Until both are real, the Android app shows a browser address bar at the top. SF-021's final
audit fails the release while a placeholder remains. A change to this file deploys like any
other (a push to `main`).

## 6. Move the family's phones from GitHub Pages

Today the app is live at `https://revanparimi.github.io/SplitFamilia/`. The Railway address is a
different site to a phone, so the saved group and the installed icon stay with the old address.
The data is in Firestore, so nothing is lost.

1. **MANUAL ACTION REQUIRED:** on each phone, open the group's invite link on the new address
   once (step 4.3 above). The phone saves the group for the new address.
2. On each phone, install from the new address (Chrome menu → **Install app** or **Add to Home
   screen**), then remove the old icon.
3. **MANUAL ACTION REQUIRED: turn off GitHub Pages** only after every phone has moved: the
   GitHub repository → **Settings → Pages** → set the source to none (or **Unpublish**). Until
   then, every push to `main` updates both addresses, and Pages also publishes everything in the
   repo, including `docs/` and `tests/`.

## 7. Later: limit the Firebase key to your addresses (optional)

The Firebase web key in `index.html` is public by design; the Firestore rules protect the data
(see `FIRESTORE_RULES.md`). If you later restrict the key to your own websites (Google Cloud
console → **APIs & Services → Credentials** → the browser key → **Website restrictions**),
**MANUAL ACTION REQUIRED:** add `https://<host>/*`, and keep the GitHub Pages address until
Pages is off. The Android app uses the same web address, so it needs nothing extra. This counts
as a deploy (CLAUDE.md §5).

## 8. Roll back

- **MANUAL ACTION REQUIRED:** in Railway, open the service's **Deployments**, pick the last good
  one and choose **Redeploy**; or revert the commit on `main` and push (your word first).
- Phones pick up the rolled-back files within an open or two, as with any update: the first open
  may still show the cached version while the service worker fetches the other one.
