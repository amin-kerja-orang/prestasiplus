#!/usr/bin/env bash
# First Let's Encrypt certificate for PP_DOMAIN (AZ-09). Runbook: docs/ops/production-vps.md (section 6)
#
#   deploy/vps/tls/init-cert.sh [--dry-run] [--staging] [--yes]
#
# Prerequisites: the DNS A record of PP_DOMAIN points at THIS server (the edge listens on IPv4 only) and ports 80 and
# 443 are open (ufw).
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
    -h|--help) sed -n '2,14p' "${BASH_SOURCE[0]}"; exit 0 ;;
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

[ "$dry" = 1 ] || pp_lock 0
mkdir -p "$web_dir" "$log_dir" "$le_dir/live"

# A placeholder (issuer == subject) left by an earlier run is reused; a half-finished earlier run (the placeholder
# parked in live/$domain.placeholder) is put back first, so a re-run never nests directories.
if [ -d "$le_dir/live/$domain.placeholder" ]; then
  if [ -e "$le_dir/live/$domain" ]; then rm -rf "$le_dir/live/$domain.placeholder"
  else mv "$le_dir/live/$domain.placeholder" "$le_dir/live/$domain"; pp_log "restored the placeholder left by an earlier run"; fi
fi
had_real=0
if [ -f "$le_dir/renewal/$domain.conf" ]; then had_real=1; pp_log "a certbot-managed certificate already exists for $domain"; fi

placeholder=0
if [ "$had_real" = 0 ]; then
  if [ -f "$le_dir/live/$domain/fullchain.pem" ]; then
    if pp_cert_is_selfsigned "$(cat "$le_dir/live/$domain/fullchain.pem")"; then placeholder=1; pp_log "reusing the existing placeholder"
    else pp_die "$le_dir/live/$domain holds a certificate that certbot does not manage and that is not a placeholder; move it away first"; fi
  else
    pp_log "creating a 1-day self-signed placeholder so the edge can start"
    mkdir -p "$le_dir/live/$domain"
    openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$domain" \
      -keyout "$le_dir/live/$domain/privkey.pem" -out "$le_dir/live/$domain/fullchain.pem" 2>/dev/null
    placeholder=1
  fi
fi

pp_log "starting the edge (nginx) alone"
pp_compose up -d --no-deps --wait edge

cb=(pp_compose --profile tls run --rm certbot)
args=(certonly --webroot -w /var/www/certbot -d "$domain" --email "$email" --agree-tos --no-eff-email --non-interactive --cert-name "$domain")
[ "$dry" = 0 ] || args+=(--dry-run)
[ "$staging" = 0 ] || args+=(--staging)

cert_ok=0; moved=0
restore_placeholder() { # EXIT trap: after a failed (or dry) run the edge must find a certificate again
  if [ "$moved" = 1 ] && { [ "$dry" = 1 ] || [ "$cert_ok" = 0 ]; }; then
    [ -f "$le_dir/renewal/$domain.conf" ] || rm -rf "${le_dir:?}/live/$domain"
    if [ ! -e "$le_dir/live/$domain" ] && [ -d "$le_dir/live/$domain.placeholder" ]; then
      mv "$le_dir/live/$domain.placeholder" "$le_dir/live/$domain"
      pp_log "the placeholder certificate was put back"
    fi
  fi
}
if [ "$placeholder" = 1 ]; then
  # certbot refuses to write over an existing live/ directory that it did not create. The running nginx already
  # holds the placeholder in memory. It is restored if certbot fails and after a dry run; a real success deletes it.
  pp_log "moving the placeholder aside"
  rm -rf "${le_dir:?}/live/$domain.placeholder"
  mv "$le_dir/live/$domain" "$le_dir/live/$domain.placeholder"
  moved=1
  trap restore_placeholder EXIT
fi
"${cb[@]}" "${args[@]}"
cert_ok=1
if [ "$moved" = 1 ] && [ "$dry" = 0 ]; then rm -rf "${le_dir:?}/live/$domain.placeholder"; fi

if [ "$dry" = 0 ]; then
  pp_compose exec -T edge nginx -s reload
  pp_log "certificate installed for $domain; edge reloaded"
else
  pp_log "certbot dry run finished OK; the placeholder certificate stays until the real run"
fi
