// Starts SplitFamilia's server: `node server/main.js` (in the Docker image, and `npm start`
// here). It listens on $PORT (8080 if unset) and keeps the database in Railway's volume when one
// is attached, otherwise in data/. See docs/google-play/HOSTING_RAILWAY.md.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./server.js";
import { dataDir, DB_FILE_NAME } from "./db.js";
import { MIN_IMPORT_TOKEN_LENGTH } from "./api.js";

const env = process.env;
const onRailway = Boolean(env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT);
const volume = Boolean(env.RAILWAY_VOLUME_MOUNT_PATH);
if(onRailway && !volume){
  console.log("SplitFamilia server: no Railway volume is attached, so the database won't survive a redeploy.");
}

// The import endpoint (SF-037) is open only while the owner sets IMPORT_TOKEN for the move. The
// log says whether it is on, never the token.
const importToken = env.IMPORT_TOKEN || "";
if(importToken && importToken.length < MIN_IMPORT_TOKEN_LENGTH){
  console.log("SplitFamilia server: IMPORT_TOKEN is shorter than " + MIN_IMPORT_TOKEN_LENGTH + " characters, so the import endpoint stays off.");
}else if(importToken){
  console.log("SplitFamilia server: the import endpoint is on. Remove IMPORT_TOKEN once the move is done.");
}

const app = createApp({
  root: fileURLToPath(new URL("../", import.meta.url)),
  dbFile: join(dataDir(env), DB_FILE_NAME),
  storage: volume ? "volume" : "local",
  trustProxy: onRailway,
  importToken: importToken
});

const port = Number(env.PORT) || 8080;
app.server.listen(port, function(){
  console.log("SplitFamilia server: listening on port " + port + "; database " + (app.ledger ? "ok" : "unavailable") + ".");
});

// Railway stops the old deployment with SIGTERM when a new one starts.
let stopping = false;
["SIGTERM", "SIGINT"].forEach(function(signal){
  process.on(signal, function(){
    if(stopping) return;
    stopping = true;
    console.log("SplitFamilia server: stopping (" + signal + ").");
    app.close().then(function(){ process.exit(0); });
    setTimeout(function(){ process.exit(0); }, 5000).unref();
  });
});
