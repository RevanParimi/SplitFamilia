# Hosting SplitFamilia on Railway

The web app will run as a Railway service at one HTTPS address, for example
`https://splitfamilia.up.railway.app`. The Android app (SF-012) opens that address, so it must
be live before the Android work starts (task T-05).

- **What the repository does:** the files that build and serve the app (T-03, SF-011), and since
  T-08 (SF-031 to SF-034) a small Node server with the ledger's database and API. Since T-09 the
  page uses only that server: the move from Firebase is in
  [MOVE_FROM_FIREBASE.md](MOVE_FROM_FIREBASE.md).
- **What you do by hand:** every step marked **MANUAL ACTION REQUIRED** below. Nothing in this
  repo creates or changes anything in Railway, GitHub or Firebase.

Decisions behind this: D-3 (Railway, like StockAgent), D-5 (a push to `main` deploys), D-10 (the
free `*.up.railway.app` address), D-13 (the database: SQLite on a Railway volume). See
`docs/planning/STATE.json`.

## 1. What is in the repository

| File | What it does |
|---|---|
| `Dockerfile` | Builds a small image from `node:24.21.0-alpine` holding only the app's files (`index.html`, `manifest.json`, `service-worker.js`, the JS modules, the icons, `.well-known/assetlinks.json`) and the server (`server/`). No docs, tests, scripts, tooling or `npm install`: the server uses only Node's built-in modules. |
| `.dockerignore` | Lets only those files into the build, as a second guard. |
| `server/` | The web server (T-08). It listens on `$PORT` (8080 if unset) and serves the app's files from a fixed list, with the headers below; everything else is a 404. It also answers `/healthz` and the ledger API under `/api/`, and keeps the database in the volume (section 3a). Railway handles HTTPS in front of it. |
| `railway.json` | Railway's settings as code: build with the `Dockerfile`, check `/healthz` after each deploy, restart on failure, and redeploy only when an app or server file changes (a docs-only commit doesn't redeploy). Railway reads it from the repo; it overrides the same settings in the dashboard. |
| `.well-known/assetlinks.json` | Tells Android that the SplitFamilia app (`com.splitfamilia.app`) may open this site full screen. Its two fingerprints are placeholders for now (see section 5). |

Headers on every file: `Cache-Control: no-cache` (a phone checks for a new version each time it
opens the app; an unchanged file costs a quick "not modified"), `X-Content-Type-Options: nosniff`
and `Referrer-Policy: strict-origin-when-cross-origin`. `assetlinks.json` is sent as
`application/json`. Text files are gzipped for browsers that ask. These are the same headers the
Caddy server sent before T-08.

`npm test` checks that the server serves exactly the files the service worker caches (plus the
worker, the iPhone icon and `assetlinks.json`), that the image ships them and every server file,
and that no shipped file has an `http://` or `localhost` address.

How it was tested (T-08): `npm test` runs the real server in-process, and
`docs/planning/evidence/T-08-image-check.mjs` stages exactly what the `Dockerfile` copies and
starts it as the image would. Docker isn't installed on the development machine, so **the image
itself was not built**; Railway's next build is its first real build. If it fails, its build log
says why, and the last good deployment stays live (the health check never passes).

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
5. Wait for the deploy to finish. The deploy log should show
   `SplitFamilia server: listening on port 8080; database ok.`, and the health check on
   `/healthz` should pass.

## 3a. The database: region, volume and backups (T-08)

The server keeps every group in one SQLite file. Railway only keeps a file across deploys if it
is on a **volume**. Without one, the database is wiped by each deploy. In T-08 nothing is stored
there yet (the page still uses Firestore until T-09), so a missing volume costs nothing now. It
**must** be in place before T-09's switch-over. Doing it before the T-08 push is simplest.

Railway's screens change from time to time. **VERIFY IN RAILWAY** the exact menu names below.

1. **MANUAL ACTION REQUIRED: pick the region first.** In the service's **Settings → Deploy →
   Regions**, choose **Southeast Asia (Singapore)**, the closest to India. A volume stays in the
   region it was made in, so set this before step 2. (Done on 2026-09-30: the service panel shows
   "Southeast Asia".)
2. **MANUAL ACTION REQUIRED: add a volume.** Railway's volume guide (checked 2026-09-30) gives
   two ways:
   - right-click an empty part of the project canvas (the dotted area) and choose the volume
     option;
   - or press **Ctrl+K** (the command palette) and type "volume".

   Railway then asks which service to connect it to: choose **SplitFamilia**. Set the **mount
   path** to **`/data`**. Railway then gives the service the variables `RAILWAY_VOLUME_NAME` and
   `RAILWAY_VOLUME_MOUNT_PATH`, and the server puts `splitfamilia.db` there. Don't set them
   yourself. Railway redeploys the service to mount the volume. The volume shows on the canvas
   under the service.
3. **MANUAL ACTION REQUIRED: turn on backups.** Once the volume is attached, the service's panel
   gets a **Backups** tab, next to Deployments, Variables, Metrics, Console and Settings. There
   you can make a backup now and set a schedule. Railway's backups guide (checked 2026-09-30)
   lists:
   - **Daily:** every 24 hours, each kept 6 days (recommended);
   - **Weekly:** every 7 days, kept 27 days;
   - **Monthly:** every 30 days, kept 89 days.

   To restore, pick a backup by its date, choose **Restore**, then **Deploy**; the old volume
   is kept, unmounted. **VERIFY IN RAILWAY:** the Pro plan's backup price, if any.

   Steps 2 and 3 were done on 2026-09-30: a volume at `/data` and a daily backup schedule (the
   owner's report).
4. Redeploy (or push, on your word). Then open `https://<host>/healthz`. It should say
   `{"status":"ok","database":"ok","storage":"volume"}`:
   - `"storage":"local"` means no volume is attached;
   - `"database":"unavailable"` means the file couldn't be opened. The deploy log says why, and
     the page is still served.

What to expect: with a volume, Railway runs only one copy of the service. Each deploy has a few
seconds of downtime, because the old copy stops before the new one mounts the volume (Railway's
volume guide says so). From T-09, phones keep changes made during those seconds and send them
afterwards.

Since T-09, `/healthz` answers **503** when the database can't be opened (the T-08 review's
N-5). Railway's health check then fails, and it keeps the last good deployment live instead.

5. **MANUAL ACTION REQUIRED: check the volume's use once a month.** Open the volume on the
   project canvas (or the service's **Metrics**). A family uses a few megabytes a year. The
   server limits how fast anyone can write: 300 changes per address per 10 minutes, and at most
   5,000 expenses and 20,000 split entries in one group. That slows a flood but doesn't cap the
   total: one address writing flat out could add about 590 MB a day (the second T-08 review's
   N-6). The Pro plan's volume is 50 GB and can be made bigger (Railway's docs, checked
   2026-09-30). **VERIFY IN RAILWAY:** whether your plan can send a usage alert; the docs
   don't mention one. If the use grows fast, tell the next session.

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

After the T-08 push (pending check PC-005): `https://<host>/healthz` answers 200 as in section
3a, and the family group opens exactly as before. The page itself doesn't change in T-08, so
phones see no difference.

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

Since T-09 this is part of the switch-over: [MOVE_FROM_FIREBASE.md](MOVE_FROM_FIREBASE.md)
steps 7 and 8. After push B, the page on GitHub Pages only shows "SplitFamilia has moved", with
a button to the same group on this address. The steps as they were:


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

## 7. The Firebase key (no longer needed)

Until T-09 the page carried Firebase's web key. Since T-09 it has no Firebase key or setting at
all (`npm test` checks), so there is nothing to restrict. The Firebase project itself is
deleted at the end of the switch-over (MOVE_FROM_FIREBASE.md step 8).

## 8. Roll back

- **MANUAL ACTION REQUIRED:** in Railway, open the service's **Deployments**, pick the last good
  one and choose **Redeploy**; or revert the commit on `main` and push (your word first).
  Rolling back to the Caddy deployment (before T-08) was safe while the page still used
  Firestore. After T-09's switch-over, roll back only as MOVE_FROM_FIREBASE.md says: the page
  and its data now live here.
- Phones pick up the rolled-back files within an open or two, as with any update: the first open
  may still show the cached version while the service worker fetches the other one.
