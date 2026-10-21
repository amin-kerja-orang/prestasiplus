#!/usr/bin/env bash
# Behaviour test of the edge nginx config with stub upstreams (no Docker): runs the host's nginx on high ports with
# the real template, two tiny Python servers as api and frontend, and curl. Proves: /api/metrics is 404 in every
# spelling, http redirects to the fixed host, X-Forwarded-For cannot be spoofed, body limits per route tier, the SPA
# gets HSTS and the CSP while /api gets none from the edge, unknown hosts get no certificate.
#   deploy/vps/nginx/test-routing.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for c in nginx openssl perl python3 curl; do command -v "$c" >/dev/null || { echo "missing: $c" >&2; exit 2; }; done
w="$(mktemp -d)"
pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; [ ! -f "$w/n.pid" ] || nginx -p "$w" -c "$w/nginx.conf" -s stop 2>/dev/null || true; rm -rf "$w"; }
trap cleanup EXIT
mkdir -p "$w/conf.d" "$w/tmp" "$w/le/live/t.example.my" "$w/snip" "$w/web"
# nginx workers drop to an unprivileged user when this runs as root: let them write the temp dir
chmod 755 "$w"
chmod 777 "$w/tmp"
export PP_DOMAIN=t.example.my PP_UPLOAD_FILES_MB=22 PP_UPLOAD_BIG_MB=256 PP_CSP_IMG_HOSTS="https://img.youtube.com" PP_CSP_MODE=report-only PP_EDGE_AUTH_RATE=30r/m PP_EDGE_AUTH_BURST=5
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$PP_DOMAIN" -keyout "$w/le/live/$PP_DOMAIN/privkey.pem" -out "$w/le/live/$PP_DOMAIN/fullchain.pem" 2>/dev/null
cp "$here"/snippets/*.conf "$w/snip/"
for t in "$here"/templates/snippets/*.template; do
  out="$(basename "$t" .template)"
  perl -pe 's/\$\{(PP_[A-Z_]+)\}/$ENV{$1}/g' <"$t" >"$w/snip/$out"
done
perl -pe 's/\$\{(PP_[A-Z_]+)\}/$ENV{$1}/g' "$here/templates/pp.conf.template" \
  | sed -e "s#/etc/letsencrypt#$w/le#g" -e "s#/etc/nginx/pp-snippets#$w/snip#g" -e "s#/etc/nginx/conf.d/snippets#$w/snip#g" -e "s#/var/www/certbot#$w/web#g" -e '/http2 on;/d' \
        -e 's#listen 80 default_server#listen 18080 default_server#' -e 's#listen 443 ssl#listen 18443 ssl#' \
        -e 's#http://api:3000#http://127.0.0.1:13000#' -e 's#http://frontend:8080#http://127.0.0.1:18081#' \
        -e 's#resolver 127.0.0.11.*#resolver 127.0.0.1;#' -e 's#return 301 https://t.example.my#return 301 https://t.example.my:18443#' >"$w/conf.d/pp.conf"
sed -e "s#/var/cache/nginx/#@@CACHE@@/#g" -e "s#/tmp/#$w/tmp/#g" -e "s#@@CACHE@@/#$w/tmp/#g" -e '/^user /d' -e "s#/etc/nginx/conf.d#$w/conf.d#" -e "s#^pid .*#pid $w/n.pid;#" -e "s#^error_log .*#error_log $w/err.log warn;#" \
    -e "s#access_log /dev/stdout#access_log $w/acc.log#" "$here/nginx.conf" >"$w/nginx.conf"
cat >"$w/stub.py" <<'PY'
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
name, port = sys.argv[1], int(sys.argv[2])
class H(BaseHTTPRequestHandler):
    def reply(self):
        n = int(self.headers.get('Content-Length', 0)); self.rfile.read(n)
        self.send_response(200); self.send_header('X-Stub', name); self.send_header('X-Seen-XFF', self.headers.get('X-Forwarded-For', '-')); self.end_headers(); self.wfile.write(b'ok')
    do_GET = do_POST = do_PUT = reply
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', port), H).serve_forever()
PY
python3 "$w/stub.py" api 13000 & pids+=($!)
python3 "$w/stub.py" spa 18081 & pids+=($!)
nginx -p "$w" -c "$w/nginx.conf"
sleep 1

fails=0
curlx() { curl --noproxy '*' -sk --resolve "$PP_DOMAIN:18443:127.0.0.1" "$@"; }
code() { curlx -o /dev/null -w '%{http_code}' "$@"; }
expect() { # expect LABEL WANT GOT
  if [ "$2" = "$3" ]; then printf 'PASS  %s (%s)\n' "$1" "$3"; else printf 'FAIL  %s: want %s, got %s\n' "$1" "$2" "$3"; fails=$((fails + 1)); fi
}
B="https://$PP_DOMAIN:18443"
for p in /api/metrics /api/metrics/ /api/Metrics /api/METRICS/ /api/metrics/x //api//metrics /api/./metrics /api/%6detrics; do
  expect "metrics hidden: $p" 404 "$(code --path-as-is "$B$p")"
done
expect "api health reaches the api" 200 "$(code "$B/api/health")"
expect "XFF is overwritten by the peer address" "127.0.0.1" "$(curlx -D- -o /dev/null -H 'X-Forwarded-For: 6.6.6.6' "$B/api/health" | tr -d '\r' | sed -n 's/^X-Seen-XFF: //Ip')"
expect "http redirects to the fixed host" "301 https://$PP_DOMAIN:18443/x" "$(curl --noproxy '*' -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: evil.test' http://127.0.0.1:18080/x)"
expect "SPA has HSTS" 1 "$(curlx -D- -o /dev/null "$B/deep/link" | grep -ci '^strict-transport-security')"
expect "SPA has the CSP (report-only)" 1 "$(curlx -D- -o /dev/null "$B/deep/link" | grep -ci '^content-security-policy-report-only')"
expect "metrics 404 carries HSTS (nginx-answered)" 1 "$(curlx -D- -o /dev/null "$B/api/metrics" | grep -ci '^strict-transport-security')"
expect "CSP img-src has no bare https:" 0 "$(curlx -D- -o /dev/null "$B/deep/link" | grep -ci "img-src[^;]* https:;")"
expect "CSP img-src carries PP_CSP_IMG_HOSTS" 1 "$(curlx -D- -o /dev/null "$B/deep/link" | grep -ci "img-src[^;]*https://img.youtube.com")"
expect "edge adds no HSTS/CSP on /api" 0 "$(curlx -D- -o /dev/null "$B/api/health" | grep -ciE '^(strict-transport|content-security)')"
expect "unknown host gets no certificate" "handshake-refused" "$(curl --noproxy '*' -sk -o /dev/null --resolve other.test:18443:127.0.0.1 https://other.test:18443/ && echo served || echo handshake-refused)"
head -c 4000000 /dev/zero >"$w/4m"; head -c 30000000 /dev/zero >"$w/30m"; head -c 100000000 /dev/zero >"$w/100m"
expect "4 MB JSON route is refused" 413 "$(code -X POST --data-binary @"$w/4m" "$B/api/foo")"
expect "4 MB /api/files is allowed" 200 "$(code -X POST --data-binary @"$w/4m" "$B/api/files")"
expect "30 MB /api/files is refused" 413 "$(code -X POST --data-binary @"$w/30m" "$B/api/files")"
expect "30 MB Bijak photo is refused" 413 "$(code -X POST --data-binary @"$w/30m" "$B/api/bijak/attempts/a1/photos")"
expect "30 MB intake file upload is allowed" 200 "$(code -X POST --data-binary @"$w/30m" "$B/api/intake/batches/abc/files")"
expect "100 MB audio KBAT create is allowed" 200 "$(code -X POST --data-binary @"$w/100m" "$B/api/admin/audio-kbat-sets")"
# edge flood guard on /api/auth/ (30r/m, burst 5 in this test): the first requests pass, a rapid run gets 429,
# and other API paths are not affected
u="https://$PP_DOMAIN:18443"
first="$(code -X POST "$u/api/auth/login")"
codes=""; for _ in 1 2 3 4 5 6 7 8; do codes="$codes $(code -X POST "$u/api/auth/login")"; done
expect "auth: first request passes" "200" "$first"
expect "auth: a rapid burst is limited" "yes" "$(case "$codes" in *429*) echo yes ;; *) echo "no:$codes" ;; esac)"
last=""; for _ in 1 2 3 4 5 6 7 8 9 10; do last="$(code "$u/api/health")"; done
expect "other /api paths are not limited" "200" "$last"

if [ "$fails" -eq 0 ]; then echo "ALL PASSED"; else echo "$fails FAILED"; exit 1; fi
