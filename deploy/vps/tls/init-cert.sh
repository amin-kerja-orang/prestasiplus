#!/usr/bin/env bash
# First Let's Encrypt certificate for PP_DOMAIN (AZ-09). Runbook: docs/ops/production-vps.md (section 6)
#
#   deploy/vps/tls/init-cert.sh [--dry-run] [--staging] [--yes]
#
# Prerequisites: the DNS A/AAAA record of PP_DOMAIN points at THIS server and ports 80 and 443 are open (ufw).
# Steps: 1 put a short-lived self-signed certificate in place so the edge nginx can start; 2 start the edge alone;
# 3 remove the placeholder; 4 certbot (webroot, served by the edge on port 80) issues the real certificate;
# 5 reload the edge. --dry-run uses certbot's own --dry-run against the Let's Encrypt staging servers: it proves
# the webroot and DNS path without issuing anything and without counting against the rate limits.
# --staging issues a real but untrusted staging certificate (browsers warn); use it for a rehearsal on a throw-away name.
set -Eeuo pipefail
umask 077
export PP_SCRIPT=init-cert
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

dry=0; staging=0; yes=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry=1; shift ;;
    --staging) staging=1; shift ;;
    --yes) yes=1; shift ;;
    -h|--help) sed -n '2,13p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) pp_die "unknown argument: $1" 2 ;;
  esac
done

domain="$(pp_cfg PP_DOMAIN '')"
email="$(pp_cfg PP_LETSENCRYPT_EMAIL '')"
le_dir="$(pp_cfg PP_LE_DIR /srv/pretasiplus/letsencrypt)"
web_dir="$(pp_cfg PP_WEBROOT_DIR /srv/pretasiplus/certbot-webroot)"
log_dir="$(pp_cfg PP_LE_LOG_DIR /srv/pretasiplus/letsencrypt-log)"
if [ -z "$domain" ] || [ "$domain" = app.example.my ]; then pp_die "set the real PP_DOMAIN in $PP_PROD_ENV"; fi
if [ -z "$email" ] || [ "$email" = ops@example.my ]; then pp_die "set a real PP_LETSENCRYPT_EMAIL in $PP_PROD_ENV"; fi
command -v openssl >/dev/null || pp_die "openssl is required on the host"
export PP_IMAGE_TAG="${PP_IMAGE_TAG:-prod}"

if command -v getent >/dev/null; then
  pp_log "DNS check (informational): $domain -> $(getent ahosts "$domain" | awk '{print $1}' | sort -u | tr '\n' ' ')"
fi

if [ "$dry" = 0 ] && [ "$yes" = 0 ]; then
  printf 'Request a Let'"'"'s Encrypt certificate for %s now? Type the domain to confirm: ' "$domain" >&2
  read -r answer
  [ "$answer" = "$domain" ] || pp_die "not confirmed"
fi

mkdir -p "$le_dir/live/$domain" "$web_dir" "$log_dir"
had_real=0
if [ -f "$le_dir/renewal/$domain.conf" ]; then had_real=1; pp_log "a certbot-managed certificate already exists for $domain"; fi

if [ "$had_real" = 0 ] && [ ! -f "$le_dir/live/$domain/fullchain.pem" ]; then
  pp_log "creating a 1-day self-signed placeholder so the edge can start"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$domain" \
    -keyout "$le_dir/live/$domain/privkey.pem" -out "$le_dir/live/$domain/fullchain.pem" 2>/dev/null
  placeholder=1
else
  placeholder=0
fi

pp_log "starting the edge (nginx) alone"
pp_compose up -d --no-deps --wait edge

cb=(pp_compose --profile tls run --rm certbot)
args=(certonly --webroot -w /var/www/certbot -d "$domain" --email "$email" --agree-tos --no-eff-email --non-interactive --cert-name "$domain")
[ "$dry" = 0 ] || args+=(--dry-run)
[ "$staging" = 0 ] || args+=(--staging)

if [ "$placeholder" = 1 ]; then
  # certbot refuses to write over an existing live/ directory that it did not create. The running nginx already
  # holds the placeholder in memory. A dry run puts it back afterwards; a real run replaces it for good.
  pp_log "moving the placeholder aside"
  mv "$le_dir/live/$domain" "$le_dir/live/$domain.placeholder"
  if [ "$dry" = 1 ]; then trap 'mv "$le_dir/live/$domain.placeholder" "$le_dir/live/$domain"' EXIT; fi
fi
"${cb[@]}" "${args[@]}"
if [ "$placeholder" = 1 ] && [ "$dry" = 0 ]; then rm -rf "$le_dir/live/$domain.placeholder"; fi

if [ "$dry" = 0 ]; then
  pp_compose exec -T edge nginx -s reload
  pp_log "certificate installed for $domain; edge reloaded"
else
  pp_log "certbot dry run finished OK; the placeholder certificate stays until the real run"
fi
