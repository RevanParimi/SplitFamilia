# SplitFamilia on Railway (SF-031): one small Node server that serves the app's files and the
# ledger API. It uses only Node's built-in modules, so nothing is installed.
# Only the files the app needs are copied: no docs, tests, tooling or Firebase settings.
# tests/wiring.test.js checks this list against the service worker's SHELL, the server's list of
# files and imports, and .dockerignore.
FROM node:24.21.0-alpine

WORKDIR /app
# The server and the page's modules are ES modules.
RUN echo '{ "type": "module" }' > /app/package.json

COPY index.html manifest.json service-worker.js /app/
COPY money.js group-code.js sync-status.js ledger-rules.js ledger-client.js outbox.js recent-groups.js /app/
COPY icon-192.png icon-512.png apple-touch-icon.png /app/
COPY .well-known/assetlinks.json /app/.well-known/assetlinks.json
COPY server/main.js server/server.js server/static.js server/db.js server/api.js server/live.js /app/server/

# Runs as root: Railway mounts volumes as root, and the database lives on the volume
# (RAILWAY_VOLUME_MOUNT_PATH). Railway sets $PORT; the server uses 8080 when it isn't set.
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server/main.js"]
