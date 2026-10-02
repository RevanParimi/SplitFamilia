#!/usr/bin/env bash
# T-06 / SF-021: the final repository audit (the brief's "Final repository audit" list), in Git
# Bash from the repository root. Prints locations and counts only, never a matched value, so the
# output can be kept as evidence. Results and their classification: PRODUCTION_AUDIT.md, "Final
# audit". node_modules/ (git-ignored old Firebase tools) and .git/ are never searched.
#   bash docs/planning/evidence/T-06-audit.sh > docs/planning/evidence/T-06-audit-output.txt
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
REVS=$(git rev-list --all)
# Tracked files plus new files not yet committed (but not ignored ones).
FILES=$(git ls-files -co --exclude-standard | grep -v "^docs/planning/evidence/T-06-audit")
SHIPPED="index.html privacy.html manifest.json service-worker.js money.js group-code.js sync-status.js ledger-rules.js ledger-client.js outbox.js recent-groups.js .well-known/assetlinks.json server/main.js server/server.js server/static.js server/db.js server/api.js server/live.js"
ANDROID_SRC=$(git ls-files -co --exclude-standard android | grep -vE '\.(png|jar|webp)$')
in_files(){ printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 grep -IlE "$@" 2>/dev/null; }
count_files(){ printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 grep -IciE "$@" 2>/dev/null | grep -v ':0$'; }

echo "Audit run: $(date -u +%FT%TZ) (UTC); HEAD $(git rev-parse --short HEAD); $(echo "$REVS" | wc -l) commits; $(printf '%s\n' "$FILES" | wc -l) files in the tree"
echo
echo "== 1. Key-like paths ever committed, or in the tree now"
git log --all --name-only --pretty=format: | sort -u > /tmp/sf-paths.txt
printf '%s\n' "$FILES" >> /tmp/sf-paths.txt
sort -u /tmp/sf-paths.txt | grep -iE '\.(jks|keystore|p12|pem|key|pfx|aab|apk|db|sqlite)$|(^|/)\.env|service.?account|google-services|credentials|(^|/)keystore\.properties$|key\.properties$|(^|/)data/|local\.properties$' || echo "(none)"
rm -f /tmp/sf-paths.txt

echo
echo "== 2. Secret patterns in every commit (text files): rev:file:count"
P='BEGIN [A-Z ]*PRIVATE KEY|"private_key"|"type": *"service_account"|client_secret|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|xox[abprs]-|-----BEGIN'
git grep -cIE -e "$P" $REVS 2>/dev/null | sed -E 's/^([0-9a-f]{7})[0-9a-f]{33}/\1/' || true
echo "(end)"
echo "-- of which Firebase web API keys (AIza...), by commit:file"
git grep -lIE 'AIza[0-9A-Za-z_-]{35}' $REVS 2>/dev/null | sed -E 's/^([0-9a-f]{7})[0-9a-f]{33}/\1/' || true

echo
echo "== 3. PEM private keys in any file of any commit, binary included (count)"
git grep -laE -e 'BEGIN [A-Z ]*PRIVATE KEY' $REVS 2>/dev/null | wc -l

echo
echo "== 4. The tree now: the same patterns, and value-like assignments to password/secret/token"
in_files -e "$P" || echo "(no secret pattern)"
echo "-- assignments of a 6+ character literal to a password, secret, token or key name:"
in_files -e '(password|passwd|secret|token|api_?key|storePassword|keyPassword)[A-Za-z_]*\s*[:=]\s*["'"'"'][^"'"'"' <$]{6,}' || echo "(none)"
echo "-- files that mention password/secret/token at all (count of lines):"
count_files -e 'password|passwd|secret|token' || true

echo
echo "== 5. Git-ignored local files that hold or may hold secrets (names only)"
for f in data android/keystore.properties android/local.properties .env; do [ -e "$f" ] && echo "present: $f" && git check-ignore -q "$f" && echo "  ignored by .gitignore"; done
ls data 2>/dev/null | sed 's/^/  data\//'
echo "-- tracked files git would ignore (should be none):"
git ls-files -ci --exclude-standard || true

echo
echo "== 6. localhost, 127.0.0.1 and plain http:// (count of lines per file)"
count_files -e 'localhost|127\.0\.0\.1' || true
echo "-- http:// (not https):"
count_files -e 'http://' || true
echo "-- in the shipped files (must be none):"
for f in $SHIPPED; do grep -HcE 'http://|localhost|127\.0\.0\.1' "$f"; done | grep -v ':0$' || echo "(none)"
echo "-- http:// in android/ sources, by kind:"
printf '%s\n' "$ANDROID_SRC" | tr '\n' '\0' | xargs -0 grep -IhoE 'http://[A-Za-z0-9./_-]+' 2>/dev/null | sort | uniq -c

echo
echo "== 7. Debug flags"
echo "-- shipped files: console calls (all should be error codes or plain status lines):"
for f in $SHIPPED; do grep -HnE 'console\.(log|debug|info|warn|error)\(' "$f"; done | sed -E 's/^([^:]+:[0-9]+):\s*/\1: /' | cut -c1-170
echo "-- debug switches anywhere in the app, the server or android/:"
for f in $SHIPPED $ANDROID_SRC; do grep -HnIiE 'debuggable|BuildConfig\.DEBUG|isDebug|DEBUG *=|debug *: *true|enableLogging' "$f"; done || true
echo "(end)"

echo
echo "== 8. TODO, FIXME, XXX, HACK in code (case-sensitive; docs/planning excluded: its 'todo' is a status)"
printf '%s\n' "$FILES" | grep -v '^docs/planning/' | tr '\n' '\0' | xargs -0 grep -InE '\b(TODO|FIXME|XXX|HACK)\b' 2>/dev/null | cut -c1-170 || true
echo "(end)"

echo
echo "== 9. Test credentials"
count_files -e 'test@|demo@|reviewer@|@example\.|password *[:=] *[A-Za-z0-9]' || true
echo "(end)"

echo
echo "== 10. Firebase, Firestore and gstatic"
echo "-- in shipped files (must be none):"
for f in $SHIPPED; do grep -HciE 'firebase|firestore|gstatic' "$f"; done | grep -v ':0$' || echo "(none)"
echo "-- tracked files that mention them (history and guides):"
count_files -e 'firebase|firestore|gstatic' | sed 's/^/  /' || true
echo "-- Firebase settings files in the tree:"
for f in firebase.json .firebaserc firestore.rules firestore.indexes.json google-services.json; do [ -e "$f" ] && echo "present: $f"; done; echo "(end)"

echo
echo "== 11. assetlinks.json fingerprints"
node -e "const l=require('./.well-known/assetlinks.json'); const p=l[0].target.sha256_cert_fingerprints; console.log(p.length + ' entries: ' + p.map(function(x){ return /^</.test(x) ? x : 'a real fingerprint'; }).join(', '))"

echo
echo "== 12. The server's log lines (what can reach Railway's deploy logs)"
grep -nE '\blog\(|console\.log\(' server/*.js | sed -E 's/^\s+//' | cut -c1-190
