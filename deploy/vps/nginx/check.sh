#!/usr/bin/env bash
# Offline syntax check of the edge nginx config with the nginx binary of THIS machine (no Docker needed).
#   deploy/vps/nginx/check.sh [csp-mode]        csp-mode: report-only (default) | enforce | off
# Renders templates/pp.conf.template like the container entrypoint does (only ${PP_*} variables), points the
# paths at a throw-away directory, creates a self-signed certificate there, then runs `nginx -t`.
# Differences from the container: a host nginx older than 1.25.1 does not know `http2 on;` (that line is
# removed for the test only). It does not prove the upstreams resolve (they resolve at request time).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:-report-only}"
command -v nginx >/dev/null || { echo "nginx not installed" >&2; exit 2; }
command -v perl >/dev/null || { echo "perl not installed" >&2; exit 2; }
command -v openssl >/dev/null || { echo "openssl not installed" >&2; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/conf.d" "$work/tmp" "$work/le/live/test.example.my" "$work/snippets" "$work/webroot"

export PP_DOMAIN=test.example.my PP_UPLOAD_FILES_MB=22 PP_UPLOAD_BIG_MB=256 PP_CSP_IMG_HOSTS="https://img.youtube.com" PP_CSP_MODE="$mode" PP_EDGE_AUTH_RATE=60r/m PP_EDGE_AUTH_BURST=60
# PP_HSTS: same default as compose.prod.yaml; `PP_HSTS= deploy/vps/nginx/check.sh` checks the "no header" value.
export PP_HSTS="${PP_HSTS-max-age=300}"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$PP_DOMAIN" \
  -keyout "$work/le/live/$PP_DOMAIN/privkey.pem" -out "$work/le/live/$PP_DOMAIN/fullchain.pem" 2>/dev/null

cp "$here"/snippets/*.conf "$work/snippets/"
for t in "$here"/templates/snippets/*.template; do
  out="$(basename "$t" .template)"
  perl -pe 's/\$\{(PP_[A-Z_]+)\}/$ENV{$1}/g' <"$t" >"$work/snippets/$out"
done
# Same result as the image's envsubst filter for ${PP_*} (perl is used because gettext's envsubst may be missing).
perl -pe 's/\$\{(PP_[A-Z_]+)\}/$ENV{$1}/g' <"$here/templates/pp.conf.template" \
  | sed -e "s#/etc/letsencrypt#$work/le#g" \
        -e "s#/etc/nginx/pp-snippets#$work/snippets#g" -e "s#/etc/nginx/conf.d/snippets#$work/snippets#g" \
        -e "s#/var/www/certbot#$work/webroot#g" \
        -e '/^[[:space:]]*http2 on;/d' >"$work/conf.d/pp.conf"

sed -e "s#/var/cache/nginx/#@@CACHE@@/#g" -e "s#/tmp/#$work/tmp/#g" -e "s#@@CACHE@@/#$work/tmp/#g" -e '/^user /d' \
    -e "s#/etc/nginx/conf.d#$work/conf.d#" \
    -e "s#^pid .*#pid $work/nginx.pid;#" \
    -e "s#^error_log .*#error_log $work/error.log warn;#" \
    -e "s#access_log /dev/stdout#access_log $work/access.log#" \
    "$here/nginx.conf" >"$work/nginx.conf"

nginx -t -p "$work" -c "$work/nginx.conf"
echo "OK: edge nginx config is valid (csp mode: $mode)"
