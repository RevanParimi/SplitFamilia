# SplitFamilia on Railway (SF-011): the app's static files, served by Caddy on $PORT.
# Only the files the app serves are copied: no docs, tests, tooling or Firebase settings.
# tests/wiring.test.js checks that every file the service worker caches is copied here.
FROM caddy:2.11.4-alpine

COPY Caddyfile /etc/caddy/Caddyfile

COPY index.html manifest.json service-worker.js /srv/
COPY money.js group-code.js sync-status.js /srv/
COPY icon-192.png icon-512.png apple-touch-icon.png /srv/
COPY .well-known/assetlinks.json /srv/.well-known/assetlinks.json

# Railway sets $PORT; the Caddyfile uses 8080 when it isn't set.
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
